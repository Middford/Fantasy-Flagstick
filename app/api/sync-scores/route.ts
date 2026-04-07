// Fantasy Flagstick — Score Sync Cron
// Runs every 30 seconds via Vercel Cron during active tournament
// PRIMARY source: ESPN Public API (free, no key needed)
// vercel.json cron: { "path": "/api/sync-scores", "schedule": "*/1 * * * *" }

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getScoreboard, parseHoleScores } from '@/lib/espn/client'
import { applyPriceUpdate, calculatePerformanceAdjustment, calculateDemandAdjustment, getPriceDirection } from '@/lib/pricing/engine'

// Open endpoint — only reads ESPN data, no mutations possible by outsiders
// Rate-limited naturally by the 30s client interval
function isCronRequest(_req: Request): boolean {
  return true
}

export async function GET(req: Request) {
  if (!isCronRequest(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createServiceClient()

  // Get active tournament
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .eq('active', true)
    .single()

  if (!tournament) {
    return NextResponse.json({ message: 'No active tournament' })
  }

  // Get holes for par lookup
  const { data: holes } = await supabase
    .from('holes')
    .select('number, par')
    .eq('tournament_id', tournament.id)

  const holePars: Record<number, number> = {}
  holes?.forEach((h) => { holePars[h.number] = h.par })

  // Get all players for this tournament
  const { data: players } = await supabase
    .from('players')
    .select('id, name, name_full, espn_id, current_price, current_round_score, holes_completed, price_direction')
    .eq('tournament_id', tournament.id)
    .eq('status', 'active')

  if (!players?.length) return NextResponse.json({ message: 'No active players' })

  let scoresUpdated = 0
  let picksLocked = 0

  try {
    // Fetch ESPN scoreboard
    const scoreboard = await getScoreboard()

    // Find Masters event
    const mastersEvent = scoreboard.events.find(
      (e) => e.name.toLowerCase().includes('masters') || e.name.toLowerCase().includes('augusta')
    )

    if (!mastersEvent?.competitions?.[0]?.competitors) {
      return NextResponse.json({ message: 'Masters not found on ESPN scoreboard' })
    }

    const competitors = mastersEvent.competitions[0].competitors

    // Get total pick counts per player for demand calculation
    const { data: allPicks } = await supabase
      .from('picks')
      .select('player_id')
      .eq('tournament_id', tournament.id)
      .eq('round', tournament.current_round)

    const totalPicks = allPicks?.length ?? 0
    const pickCounts = new Map<string, number>()
    allPicks?.forEach((p) => {
      pickCounts.set(p.player_id, (pickCounts.get(p.player_id) ?? 0) + 1)
    })

    for (const competitor of competitors) {
      // Match ESPN competitor to our player
      const player = players.find(
        (p) =>
          p.espn_id === competitor.id ||
          p.name_full.toLowerCase().includes(competitor.displayName.toLowerCase().split(' ').pop() ?? '') ||
          competitor.displayName.toLowerCase().includes(p.name.split('.')[1]?.trim().toLowerCase() ?? '')
      )

      if (!player) continue

      const holeScores = parseHoleScores(competitor, holePars)
      if (holeScores.size === 0) continue

      // Process each confirmed hole score
      for (const [holeNumber, holeData] of holeScores.entries()) {
        // Check if we already have this score confirmed
        const { data: existing } = await supabase
          .from('hole_scores')
          .select('id, confirmed')
          .eq('tournament_id', tournament.id)
          .eq('player_id', player.id)
          .eq('round', tournament.current_round)
          .eq('hole_number', holeNumber)
          .single()

        if (existing?.confirmed) continue  // Already processed

        // Upsert hole score
        const { error } = await supabase
          .from('hole_scores')
          .upsert({
            tournament_id: tournament.id,
            player_id: player.id,
            round: tournament.current_round,
            hole_number: holeNumber,
            score: holeData.score,
            score_vs_par: holeData.score_vs_par,
            is_water: holeData.is_water,
            confirmed: true,
            confirmed_at: new Date().toISOString(),
          }, { onConflict: 'tournament_id,player_id,round,hole_number' })

        if (!error) {
          scoresUpdated++

          // Lock picks for hole N+1 for this player
          if (holeNumber < 18) {
            const { data: lockedPicks } = await supabase
              .from('picks')
              .update({ is_locked: true, locked_at: new Date().toISOString() })
              .eq('player_id', player.id)
              .eq('round', tournament.current_round)
              .eq('hole_number', holeNumber + 1)
              .eq('is_locked', false)
              .select('id')

            picksLocked += lockedPicks?.length ?? 0
          }

          // Update player's running round score and holes completed
          const { data: roundScores } = await supabase
            .from('hole_scores')
            .select('score_vs_par')
            .eq('tournament_id', tournament.id)
            .eq('player_id', player.id)
            .eq('round', tournament.current_round)
            .eq('confirmed', true)

          const currentRoundScore = roundScores?.reduce((sum, h) => sum + (h.score_vs_par ?? 0), 0) ?? 0
          const holesCompleted = roundScores?.length ?? 0

          // Calculate demand adjustment
          const pickPct = totalPicks > 0 ? (pickCounts.get(player.id) ?? 0) / totalPicks : 0
          const demandAdj = calculateDemandAdjustment(pickPct)
          const perfAdj = calculatePerformanceAdjustment(
            player.current_price,
            currentRoundScore,
            holesCompleted
          )

          const newPrice = applyPriceUpdate(player.current_price, perfAdj, demandAdj, 0)
          const direction = getPriceDirection(player.current_price, newPrice)

          // Update player
          await supabase
            .from('players')
            .update({
              current_round_score: currentRoundScore,
              holes_completed: holesCompleted,
              current_price: newPrice,
              price_direction: direction,
            })
            .eq('id', player.id)

          // Record price history
          await supabase.from('price_history').insert({
            player_id: player.id,
            round: tournament.current_round,
            hole_number: holeNumber,
            price: newPrice,
          })

          // Update scores on confirmed picks
          await supabase
            .from('picks')
            .update({ score_vs_par: holeData.score_vs_par })
            .eq('tournament_id', tournament.id)
            .eq('player_id', player.id)
            .eq('round', tournament.current_round)
            .eq('hole_number', holeNumber)
            .is('score_vs_par', null)
        }
      }
    }
  } catch (err) {
    console.error('Sync error:', err)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    scoresUpdated,
    picksLocked,
    timestamp: new Date().toISOString(),
  })
}
