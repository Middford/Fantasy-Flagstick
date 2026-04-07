// Fantasy Flagstick — Admin: Seed player field from DataGolf
// Fetches pre-tournament pricing and upserts into players table
// Protected by ADMIN_SECRET header

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { dataGolf } from '@/lib/datagolf/client'

const ADMIN_SECRET = process.env.ADMIN_SECRET

function impliedProbToPrice(winDecimalOdds: number | undefined): number {
  if (!winDecimalOdds || winDecimalOdds <= 1) return 8
  const impliedProbPct = (1 / winDecimalOdds) * 100
  return Math.min(20, Math.max(5, Math.round(impliedProbPct * 1.5 + 4)))
}

export async function POST(req: Request) {
  const secret = req.headers.get('x-admin-secret')
  if (secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createServiceClient()

  // Get active tournament (there should only be one)
  const { data: tournament, error: tErr } = await supabase
    .from('tournaments')
    .select('id, name')
    .eq('active', true)
    .single()

  if (tErr || !tournament) {
    return NextResponse.json({ error: 'No active tournament found' }, { status: 404 })
  }

  // Fetch DataGolf data in parallel
  const [fieldData, predsData] = await Promise.all([
    dataGolf.getFieldUpdates(),
    dataGolf.getPreTournamentPredictions(),
  ])

  // Build a price lookup map from predictions: dg_id and player_name → price
  const priceMap = new Map<string, number>()
  for (const pred of Object.values(predsData.baseline)) {
    const price = impliedProbToPrice(pred.win)
    priceMap.set(pred.player_name.toLowerCase(), price)
    priceMap.set(String(pred.dg_id), price)
  }

  let updated = 0
  let created = 0
  const errors: string[] = []

  for (const fp of fieldData.field) {
    const price =
      priceMap.get(String(fp.dg_id)) ??
      priceMap.get(fp.player_name.toLowerCase()) ??
      8

    // DataGolf returns names as "Last, First" (e.g. "Scheffler, Scottie")
    // Convert to: name_full "Scottie Scheffler", shortName "S. Scheffler"
    const parts = fp.player_name.replace(/,/g, '').split(' ').filter(Boolean)
    const firstName = parts.length >= 2 ? parts[parts.length - 1] : fp.player_name
    const lastName = parts.length >= 2 ? parts.slice(0, parts.length - 1).join(' ') : ''
    const nameFull = lastName ? `${firstName} ${lastName}` : firstName
    const shortName = lastName ? `${firstName[0]}. ${lastName}` : firstName

    // Try matching existing player by datagolf_id first, then name_full
    const { data: byDgId } = await supabase
      .from('players')
      .select('id')
      .eq('tournament_id', tournament.id)
      .eq('datagolf_id', String(fp.dg_id))
      .maybeSingle()

    const { data: byName } = !byDgId
      ? await supabase
          .from('players')
          .select('id')
          .eq('tournament_id', tournament.id)
          .ilike('name_full', fp.player_name)
          .maybeSingle()
      : { data: null }

    const existing = byDgId ?? byName

    if (existing) {
      const { error } = await supabase
        .from('players')
        .update({
          name: shortName,
          name_full: nameFull,
          datagolf_id: String(fp.dg_id),
          country: fp.country ?? undefined,
          price_r1: price,
          current_price: price,
        })
        .eq('id', existing.id)

      if (error) errors.push(`Update ${fp.player_name}: ${error.message}`)
      else updated++
    } else {
      const { error } = await supabase.from('players').insert({
        tournament_id: tournament.id,
        name: shortName,
        name_full: nameFull,
        country: fp.country ?? 'Unknown',
        datagolf_id: String(fp.dg_id),
        price_r1: price,
        current_price: price,
        price_direction: 'flat',
        current_round_score: 0,
        holes_completed: 0,
        total_score: 0,
        status: 'active',
      })

      if (error) errors.push(`Insert ${fp.player_name}: ${error.message}`)
      else created++
    }
  }

  return NextResponse.json({
    ok: true,
    tournament: tournament.name,
    updated,
    created,
    fieldSize: fieldData.field.length,
    errors: errors.slice(0, 10),
  })
}
