// Fantasy Flagstick — Admin: Recalculate all player prices
// Can run against active OR inactive tournaments.
// Uses price_r1 as the stable anchor + performance relative to field.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getPriceDirection } from '@/lib/pricing/engine'

const ADMIN_SECRET = process.env.ADMIN_SECRET

export async function POST(req: Request) {
  const secret = req.headers.get('x-admin-secret')
  if (secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createServiceClient()

  // Works on both active and inactive tournaments — fetch most recent
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!tournament) {
    return NextResponse.json({ error: 'No tournament found' }, { status: 404 })
  }

  const { data: players } = await supabase
    .from('players')
    .select('id, name, name_full, current_price, total_score, holes_completed, price_r1, price_direction')
    .eq('tournament_id', tournament.id)

  if (!players?.length) {
    return NextResponse.json({ error: 'No players found' }, { status: 404 })
  }

  // Field average total score (players who have started)
  const startedPlayers = players.filter((p) => (p.total_score ?? 0) !== 0 || p.holes_completed > 0)
  const fieldAvgTotal = startedPlayers.length > 0
    ? startedPlayers.reduce((sum, p) => sum + (p.total_score ?? 0), 0) / startedPlayers.length
    : 0

  let updated = 0
  const preview: Array<{ name: string; origPrice: number; newPrice: number; fieldRelative: number }> = []

  for (const player of players) {
    const origPrice = player.price_r1 ?? 8
    const totalScore = player.total_score ?? 0
    const fieldRelative = fieldAvgTotal - totalScore

    const tier = Math.max(0, Math.min(1, (origPrice - 4) / 12))
    const weight = fieldRelative >= 0 ? (1.5 - tier) : (0.5 + tier)
    const adj = fieldRelative * weight * 0.15

    const floor = Math.max(1, origPrice - 4)
    const ceiling = Math.min(16, origPrice + 4)
    const newPrice = Math.max(floor, Math.min(ceiling, Math.round((origPrice + adj) * 2) / 2))

    preview.push({ name: player.name_full, origPrice, newPrice, fieldRelative: Math.round(fieldRelative * 10) / 10 })

    if (newPrice === player.current_price) continue

    const direction = getPriceDirection(player.current_price, newPrice)
    await supabase
      .from('players')
      .update({ current_price: newPrice, price_direction: direction })
      .eq('id', player.id)

    updated++
  }

  // Sort preview by newPrice desc for easy reading
  preview.sort((a, b) => b.newPrice - a.newPrice)

  return NextResponse.json({
    ok: true,
    tournament: tournament.name,
    fieldAvgTotal: Math.round(fieldAvgTotal * 10) / 10,
    playersProcessed: players.length,
    updated,
    preview: preview.slice(0, 20),
  })
}
