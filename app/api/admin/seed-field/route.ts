// Fantasy Flagstick — Admin: Seed player field from DataGolf
// Fetches pre-tournament pricing and upserts into players table
// Protected by ADMIN_SECRET header
//
// Pricing algorithm (£4m–£16m range, avg ~£10m for £180m budget):
//   composite = 0.60 × top10_score + 0.40 × log_odds_score
//   price     = clamp( round(4 + composite × 12), 4, 16 )
//
//   top10_score    = DataGolf top-10 finish probability, normalised [0,1] across field
//   log_odds_score = log(implied_prob from bookmaker win odds), normalised [0,1] across field
//                    (falls back to 0 if outrights unavailable)

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { dataGolf } from '@/lib/datagolf/client'

const ADMIN_SECRET = process.env.ADMIN_SECRET

/**
 * Composite pricing from DataGolf top-10 prob (primary) + bookmaker implied prob (secondary).
 * Both signals are normalised across the field so we get a compressed, fair price range.
 *
 * @param top10Prob  DataGolf probability of top-10 finish (0–1)
 * @param top10Min   Field minimum top-10 prob
 * @param top10Max   Field maximum top-10 prob
 * @param logImplied log(1 / bookmaker_decimal_odds) — negative number, less negative = favourite
 * @param logMin     Field minimum log implied prob (most negative = longest shot)
 * @param logMax     Field maximum log implied prob (least negative = favourite)
 * @param hasOdds    Whether bookmaker odds data is available
 */
function compositePrice(
  top10Prob: number,
  top10Min: number,
  top10Max: number,
  logImplied: number,
  logMin: number,
  logMax: number,
  hasOdds: boolean,
): number {
  const top10Range = top10Max - top10Min || 1
  const top10Score = (top10Prob - top10Min) / top10Range

  let composite: number
  if (hasOdds && logMax !== logMin) {
    const logRange = logMax - logMin
    const logScore = (logImplied - logMin) / logRange
    composite = 0.60 * top10Score + 0.40 * logScore
  } else {
    composite = top10Score
  }

  return Math.max(4, Math.min(15, Math.round(4 + composite * 13)))
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

  // Fetch DataGolf data in parallel — outrights is best-effort
  const [fieldData, predsData, outrightResult] = await Promise.allSettled([
    dataGolf.getFieldUpdates(),
    dataGolf.getPreTournamentPredictions(),
    dataGolf.getOutrights(),
  ])

  if (fieldData.status === 'rejected') {
    return NextResponse.json({ error: 'Failed to fetch DataGolf field data' }, { status: 502 })
  }
  if (predsData.status === 'rejected') {
    return NextResponse.json({ error: 'Failed to fetch DataGolf predictions' }, { status: 502 })
  }

  const field = fieldData.value
  const preds = predsData.value
  const outrights = outrightResult.status === 'fulfilled' ? outrightResult.value : null

  // ── Build lookup maps ──────────────────────────────────────────────────────

  // top_10 probability by dg_id
  // DataGolf returns decimal ODDS (e.g. 2.09 for Scheffler = ~48% chance).
  // Convert to implied probability: prob = 1 / decimal_odds
  const top10Map = new Map<number, number>()
  const baselineEntries = Array.isArray(preds.baseline)
    ? preds.baseline
    : Object.values(preds.baseline as Record<string, typeof preds.baseline[keyof typeof preds.baseline]>)
  for (const pred of baselineEntries) {
    if (pred.top_10 != null && pred.top_10 > 0) {
      const prob = pred.top_10 > 1
        ? 1 / pred.top_10   // decimal odds → implied probability
        : pred.top_10        // already a probability (future-proof)
      top10Map.set(pred.dg_id, prob)
    }
  }

  // bookmaker log implied probability by dg_id  (log(1/decimal_odds))
  // DataGolf outrights data can be an array OR an object keyed by player — handle both
  const logOddsMap = new Map<number, number>()
  if (outrights) {
    try {
      const entries = Array.isArray(outrights.data)
        ? outrights.data
        : Object.values(outrights.data as Record<string, unknown>)
      for (const entry of entries as Array<{ dg_id?: number; win?: number }>) {
        if (entry.dg_id != null && entry.win != null && entry.win > 1) {
          logOddsMap.set(entry.dg_id, Math.log(1 / entry.win))
        }
      }
    } catch {
      // Outrights data was in an unexpected format — fall back to top_10 only pricing
    }
  }

  // ── Compute field-wide min/max for normalisation ───────────────────────────
  const top10Values = [...top10Map.values()]
  const top10Min = Math.min(...top10Values, 0.03)
  const top10Max = Math.max(...top10Values, 0.04)

  const logValues = [...logOddsMap.values()]
  const logMin = logValues.length ? Math.min(...logValues) : 0
  const logMax = logValues.length ? Math.max(...logValues) : 0
  const hasOdds = logValues.length > 0

  // ── Default price for players with no prediction data ─────────────────────
  const DEFAULT_PRICE = 6

  let updated = 0
  let created = 0
  const errors: string[] = []

  for (const fp of field.field) {
    const top10Prob = top10Map.get(fp.dg_id) ?? top10Min  // Assume worst if missing
    const logImplied = logOddsMap.get(fp.dg_id) ?? logMin  // Assume longest shot if missing

    const price = top10Map.has(fp.dg_id)
      ? compositePrice(top10Prob, top10Min, top10Max, logImplied, logMin, logMax, hasOdds)
      : DEFAULT_PRICE

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
    fieldSize: field.field.length,
    oddsAvailable: hasOdds,
    pricingRange: { min: 4, max: 16, avg: 10 },
    errors: errors.slice(0, 10),
  })
}
