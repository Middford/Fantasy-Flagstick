// Fantasy Flagstick — Score Sync Cron
// Runs every 30 seconds via client-side hook during active tournament
// PRIMARY source: ESPN Public API (free, no key needed)

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getScoreboard, parseHoleScores } from '@/lib/espn/client'
import { applyPriceUpdate, calculatePerformanceAdjustment, calculateDemandAdjustment, getPriceDirection } from '@/lib/pricing/engine'

const CUT_STATUSES = ['CUT', 'WD', 'DQ', 'MDF']

export async function GET() {
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

  // Get all active players for this tournament
  const { data: players } = await supabase
    .from('players')
    .select('id, name, name_full, espn_id, current_price, current_round_score, holes_completed, price_direction')
    .eq('tournament_id', tournament.id)
    .eq('status', 'active')

  if (!players?.length) return NextResponse.json({ message: 'No active players' })

  let scoresUpdated = 0
  let picksLocked = 0

  try {
    const scoreboard = await getScoreboard()

    const mastersEvent = scoreboard.events.find(
      (e) => e.name.toLowerCase().includes('masters') || e.name.toLowerCase().includes('augusta')
    )

    if (!mastersEvent?.competitions?.[0]?.competitors) {
      return NextResponse.json({ message: 'Masters not found on ESPN scoreboard' })
    }

    const competitors = mastersEvent.competitions[0].competitors
    const eventStatus = mastersEvent.status?.type?.state ?? 'pre'

    // ── Auto-advance round ─────────────────────────────────────────────────────
    // Detect the active round from ESPN: highest round number with per-hole data.
    // Reset holes_completed/current_round_score when advancing so players show 0/0
    // in the UI until new round scores come in. Also update local players array so
    // stale-stats comparisons later in this cycle use the correct 0 value.
    let activeSyncRound = tournament.current_round
    {
      let maxRoundWithData = 1
      for (const c of competitors) {
        for (const ls of (c.linescores ?? [])) {
          if (ls.linescores && ls.linescores.length > 0) {
            if (ls.period > maxRoundWithData) maxRoundWithData = ls.period
          }
        }
      }
      if (maxRoundWithData > activeSyncRound) {
        await supabase
          .from('tournaments')
          .update({ current_round: maxRoundWithData })
          .eq('id', tournament.id)

        await supabase
          .from('players')
          .update({ holes_completed: 0, current_round_score: 0 })
          .eq('tournament_id', tournament.id)
          .eq('status', 'active')

        // Reflect reset in local array — prevents false "stale" detections for
        // players who have no new holes yet in the new round
        players.forEach((p) => {
          p.holes_completed = 0
          p.current_round_score = 0
        })

        activeSyncRound = maxRoundWithData
        console.log(`Round advanced: ${tournament.current_round} → ${maxRoundWithData}`)
      }
    }

    // ── Cut/WD player detection ────────────────────────────────────────────────
    const cutPlayerIds: string[] = []
    const wdPlayerIds: string[] = []
    for (const competitor of competitors) {
      const scoreUpper = (competitor.score ?? '').trim().toUpperCase()
      if (!CUT_STATUSES.includes(scoreUpper)) continue
      const espnName = competitor.athlete?.displayName ?? ''
      const espnShort = competitor.athlete?.shortName ?? ''
      const player = players.find(
        (p) =>
          p.espn_id === competitor.id ||
          (espnName && p.name_full.toLowerCase() === espnName.toLowerCase()) ||
          (espnShort && p.name.toLowerCase() === espnShort.toLowerCase())
      )
      if (!player) continue
      if (scoreUpper === 'WD' || scoreUpper === 'DQ') {
        wdPlayerIds.push(player.id)
      } else {
        cutPlayerIds.push(player.id)
      }
    }
    if (cutPlayerIds.length > 0) {
      await supabase.from('players').update({ status: 'cut' }).in('id', cutPlayerIds)
      console.log(`Marked ${cutPlayerIds.length} players as cut`)
    }
    if (wdPlayerIds.length > 0) {
      await supabase.from('players').update({ status: 'withdrawn' }).in('id', wdPlayerIds)
      console.log(`Marked ${wdPlayerIds.length} players as withdrawn`)
    }

    // Get total pick counts per player for demand calculation
    const { data: allPicks } = await supabase
      .from('picks')
      .select('player_id')
      .eq('tournament_id', tournament.id)
      .eq('round', activeSyncRound)

    const totalPicks = allPicks?.length ?? 0
    const pickCounts = new Map<string, number>()
    allPicks?.forEach((p) => {
      pickCounts.set(p.player_id, (pickCounts.get(p.player_id) ?? 0) + 1)
    })

    // ── Batch fetch already-confirmed hole scores ──────────────────────────────
    // One query replaces N×18 individual SELECTs.
    const { data: confirmedScores } = await supabase
      .from('hole_scores')
      .select('player_id, hole_number')
      .eq('tournament_id', tournament.id)
      .eq('round', activeSyncRound)
      .eq('confirmed', true)

    // player_id → Set of confirmed hole numbers for this round
    const confirmedByPlayer = new Map<string, Set<number>>()
    confirmedScores?.forEach((s) => {
      if (!confirmedByPlayer.has(s.player_id)) confirmedByPlayer.set(s.player_id, new Set())
      confirmedByPlayer.get(s.player_id)!.add(s.hole_number)
    })

    for (const competitor of competitors) {
      const scoreUpper = (competitor.score ?? '').trim().toUpperCase()
      if (CUT_STATUSES.includes(scoreUpper)) continue

      const espnName = competitor.athlete?.displayName ?? ''
      const espnShort = competitor.athlete?.shortName ?? ''
      const player = players.find(
        (p) =>
          p.espn_id === competitor.id ||
          (espnName && p.name_full.toLowerCase() === espnName.toLowerCase()) ||
          (espnShort && p.name.toLowerCase() === espnShort.toLowerCase())
      )
      if (!player) continue

      const playerConfirmed = confirmedByPlayer.get(player.id) ?? new Set<number>()

      // Backfill: lock picks for holes already completed
      if (player.holes_completed > 0) {
        await supabase
          .from('picks')
          .update({ is_locked: true, locked_at: new Date().toISOString() })
          .eq('player_id', player.id)
          .eq('round', activeSyncRound)
          .lte('hole_number', player.holes_completed)
          .eq('is_locked', false)
      }

      const holeScores = parseHoleScores(competitor, holePars, activeSyncRound)

      // ── Stale stats check ──────────────────────────────────────────────────
      // Always refresh if holes_completed doesn't match confirmed count, even
      // when holeScores is empty (player hasn't started new round yet).
      // This corrects holes_completed=18 left over from previous round data.
      const confirmedCount = playerConfirmed.size
      const statsStale = player.holes_completed !== confirmedCount

      if (holeScores.size === 0 && !statsStale) continue

      let newHolesWritten = 0

      for (const [holeNumber, holeData] of holeScores.entries()) {
        // Always update pick score_vs_par (idempotent)
        await supabase
          .from('picks')
          .update({ score_vs_par: holeData.score_vs_par })
          .eq('tournament_id', tournament.id)
          .eq('player_id', player.id)
          .eq('round', activeSyncRound)
          .eq('hole_number', holeNumber)
          .is('score_vs_par', null)

        if (playerConfirmed.has(holeNumber)) continue  // Already stored

        const { error } = await supabase
          .from('hole_scores')
          .upsert({
            tournament_id: tournament.id,
            player_id: player.id,
            round: activeSyncRound,
            hole_number: holeNumber,
            score: holeData.score,
            score_vs_par: holeData.score_vs_par,
            is_water: holeData.is_water,
            confirmed: true,
            confirmed_at: new Date().toISOString(),
          }, { onConflict: 'tournament_id,player_id,round,hole_number' })

        if (!error) {
          newHolesWritten++
          scoresUpdated++
          playerConfirmed.add(holeNumber)

          // Lock completed hole + next hole
          await supabase
            .from('picks')
            .update({ is_locked: true, locked_at: new Date().toISOString() })
            .eq('player_id', player.id)
            .eq('round', activeSyncRound)
            .eq('hole_number', holeNumber)
            .eq('is_locked', false)

          if (holeNumber < 18) {
            const { data: locked } = await supabase
              .from('picks')
              .update({ is_locked: true, locked_at: new Date().toISOString() })
              .eq('player_id', player.id)
              .eq('round', activeSyncRound)
              .eq('hole_number', holeNumber + 1)
              .eq('is_locked', false)
              .select('id')
            picksLocked += locked?.length ?? 0
          }
        }
      }

      // ── Per-player stats refresh ───────────────────────────────────────────
      // Runs when: new holes written, OR stats were stale (holes_completed mismatch).
      if (newHolesWritten > 0 || statsStale) {
        const [{ data: roundScores }, { data: allRoundScores }] = await Promise.all([
          supabase
            .from('hole_scores')
            .select('score_vs_par')
            .eq('tournament_id', tournament.id)
            .eq('player_id', player.id)
            .eq('round', activeSyncRound)
            .eq('confirmed', true),
          supabase
            .from('hole_scores')
            .select('score_vs_par')
            .eq('tournament_id', tournament.id)
            .eq('player_id', player.id)
            .eq('confirmed', true),
        ])

        const currentRoundScore = roundScores?.reduce((sum, h) => sum + (h.score_vs_par ?? 0), 0) ?? 0
        const holesCompleted = roundScores?.length ?? 0
        const totalScore = allRoundScores?.reduce((sum, h) => sum + (h.score_vs_par ?? 0), 0) ?? 0

        const pickPct = totalPicks > 0 ? (pickCounts.get(player.id) ?? 0) / totalPicks : 0
        const demandAdj = calculateDemandAdjustment(pickPct)
        const perfAdj = calculatePerformanceAdjustment(player.current_price, currentRoundScore, holesCompleted)
        const newPrice = applyPriceUpdate(player.current_price, perfAdj, demandAdj, 0)
        const direction = getPriceDirection(player.current_price, newPrice)

        await supabase
          .from('players')
          .update({
            current_round_score: currentRoundScore,
            holes_completed: holesCompleted,
            total_score: totalScore,
            current_price: newPrice,
            price_direction: direction,
          })
          .eq('id', player.id)

        // Also update local copy so this sync cycle's subsequent comparisons are correct
        player.holes_completed = holesCompleted
        player.current_round_score = currentRoundScore

        if (newHolesWritten > 0) {
          await supabase.from('price_history').insert({
            player_id: player.id,
            round: activeSyncRound,
            hole_number: Math.max(...[...playerConfirmed]),
            price: newPrice,
          })
        }

        // Catch-all lock
        if (holesCompleted > 0) {
          await supabase
            .from('picks')
            .update({ is_locked: true, locked_at: new Date().toISOString() })
            .eq('player_id', player.id)
            .eq('round', activeSyncRound)
            .lte('hole_number', holesCompleted)
            .eq('is_locked', false)
        }
      }
    }

    // ── Auto-deactivate when R4 complete ───────────────────────────────────────
    if (eventStatus === 'post') {
      await supabase.from('tournaments').update({ active: false }).eq('id', tournament.id)
      console.log('Tournament complete — deactivated')
      return NextResponse.json({
        ok: true, scoresUpdated, picksLocked,
        message: 'Tournament complete — deactivated',
        timestamp: new Date().toISOString(),
      })
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
