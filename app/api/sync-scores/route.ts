// Fantasy Flagstick — Score Sync Cron
// Runs every 30 seconds via client-side hook during active tournament
// PRIMARY source: ESPN Public API (free, no key needed)

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getScoreboard, parseHoleScores } from '@/lib/espn/client'
import { getPriceDirection } from '@/lib/pricing/engine'
import { dataGolf } from '@/lib/datagolf/client'

// ESPN never shows "CUT" as a score string — cut players just get numeric scores.
// Cut detection uses DataGolf in-play predictions (make_cut ≈ 0 after cut is made).
// Only check these ESPN score strings for WD/DQ which ARE displayed explicitly.
const WD_STATUSES = ['WD', 'DQ']

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
    .select('id, name, name_full, espn_id, current_price, current_round_score, holes_completed, total_score, price_direction, status')
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
    // Two triggers:
    // 1. A later round has per-hole data (round is IN progress) → advance to that round
    // 2. The current round is "complete": ≥30 players have all 18 holes confirmed
    //    → advance to current_round + 1 (handles the gap between rounds)
    let activeSyncRound = tournament.current_round
    {
      // Count players with 18 confirmed holes per round
      const completeHoleCounts = new Map<number, number>()
      let maxRoundWithLiveData = 1
      for (const c of competitors) {
        for (const ls of (c.linescores ?? [])) {
          if (ls.linescores && ls.linescores.length > 0) {
            if (ls.period > maxRoundWithLiveData) maxRoundWithLiveData = ls.period
          }
          if ((ls.linescores?.length ?? 0) >= 18) {
            completeHoleCounts.set(ls.period, (completeHoleCounts.get(ls.period) ?? 0) + 1)
          }
        }
      }

      // Determine the round ESPN is actually on
      const currentRoundComplete = (completeHoleCounts.get(activeSyncRound) ?? 0) >= 30
      const nextRound = activeSyncRound + 1
      const targetRound = maxRoundWithLiveData > activeSyncRound
        ? maxRoundWithLiveData                          // live holes in a later round
        : (currentRoundComplete && nextRound <= 4)
          ? nextRound                                   // current round just finished
          : activeSyncRound

      if (targetRound > activeSyncRound) {
        await supabase
          .from('tournaments')
          .update({ current_round: targetRound })
          .eq('id', tournament.id)

        await supabase
          .from('players')
          .update({ holes_completed: 0, current_round_score: 0 })
          .eq('tournament_id', tournament.id)
          .eq('status', 'active')

        players.forEach((p) => { p.holes_completed = 0; p.current_round_score = 0 })
        activeSyncRound = targetRound
        console.log(`Round advanced: ${tournament.current_round} → ${targetRound}`)
      }
    }

    // ── Fetch DataGolf in-play predictions (used for cut detection + odds pricing) ───
    // Normalised name → win probability; also carries make_cut for R3+
    const winProbByPlayer = new Map<string, number>()
    const makeCutByPlayer = new Map<string, number>()
    try {
      const inPlay = await dataGolf.getInPlayPredictions()
      for (const entry of inPlay.data) {
        const parts = entry.player_name.replace(/,/g, '').split(' ').filter(Boolean)
        const normalised = parts.length >= 2
          ? `${parts[parts.length - 1]} ${parts.slice(0, -1).join(' ')}`.toLowerCase()
          : entry.player_name.toLowerCase()
        if (entry.win != null) winProbByPlayer.set(normalised, entry.win)
        if (entry.make_cut != null) makeCutByPlayer.set(normalised, entry.make_cut)
      }
    } catch {
      // DataGolf unavailable — odds pricing falls back to performance-only this cycle
    }

    // ── Cut/WD detection ──────────────────────────────────────────────────────
    // ESPN never shows "CUT" as a score string — all players show numeric totals.
    // Use DataGolf in-play predictions: make_cut ≈ 0 means the player missed the cut.
    // WD/DQ: ESPN does show these as score strings, handle them separately.
    {
      // WD/DQ from ESPN score field
      const wdPlayerIds: string[] = []
      for (const competitor of competitors) {
        const scoreUpper = (competitor.score ?? '').trim().toUpperCase()
        if (!WD_STATUSES.includes(scoreUpper)) continue
        const espnName = competitor.athlete?.displayName ?? ''
        const espnShort = competitor.athlete?.shortName ?? ''
        const player = players.find(
          (p) =>
            p.espn_id === competitor.id ||
            (espnName && p.name_full.toLowerCase() === espnName.toLowerCase()) ||
            (espnShort && p.name.toLowerCase() === espnShort.toLowerCase())
        )
        if (player) wdPlayerIds.push(player.id)
      }
      if (wdPlayerIds.length > 0) {
        await supabase.from('players').update({ status: 'withdrawn' }).in('id', wdPlayerIds)
        console.log(`Marked ${wdPlayerIds.length} players as withdrawn`)
      }

      // Cut detection from DataGolf in-play predictions (only after R2+)
      if (activeSyncRound >= 3 && makeCutByPlayer.size > 0) {
        const cutPlayerIds: string[] = []
        for (const player of players) {
          if (player.status !== 'active') continue
          const makeCut = makeCutByPlayer.get(player.name_full.toLowerCase())
            ?? makeCutByPlayer.get(player.name.toLowerCase())
          if (makeCut != null && makeCut <= 0.01) cutPlayerIds.push(player.id)
        }
        if (cutPlayerIds.length > 0) {
          await supabase.from('players').update({ status: 'cut' }).in('id', cutPlayerIds)
          console.log(`Marked ${cutPlayerIds.length} players as cut (DataGolf)`)
        }
      }
    }



    // ── Bulk price refresh: relative performance vs field, tier-weighted ─────
    // Formula:
    //   fieldRelative = fieldAvgTotal - playerTotal  (positive = beating the field)
    //   tier = (origPrice - 1) / 15  (0 = cheapest £1m, 1 = most expensive £16m)
    //   weight = outperforming ? (1.5 - tier) : (0.5 + tier)
    //     → top player outperforming:   weight 0.5  (expected, small rise)
    //     → top player underperforming: weight 1.5  (unexpected, bigger drop)
    //     → cheap player outperforming: weight 1.5  (unexpected, bigger rise)
    //     → cheap player underperforming: weight 0.5 (expected, small drop)
    //   adjustment = fieldRelative × weight × 0.4
    //   newPrice clamped to [origPrice × 0.5, origPrice × 1.5] (max ±50% swing)
    {
      // Batch fetch original pre-tournament prices (round 1, earliest hole per player)
      const { data: origPriceRows } = await supabase
        .from('price_history')
        .select('player_id, price')
        .in('player_id', players.map((p) => p.id))
        .eq('round', 1)
        .order('hole_number', { ascending: true })

      const origPriceByPlayer = new Map<string, number>()
      origPriceRows?.forEach((row) => {
        if (!origPriceByPlayer.has(row.player_id)) origPriceByPlayer.set(row.player_id, row.price)
      })

      // Field average total score (players who have started)
      const startedPlayers = players.filter((p) => (p.total_score ?? 0) !== 0 || p.holes_completed > 0)
      const fieldAvgTotal = startedPlayers.length > 0
        ? startedPlayers.reduce((sum, p) => sum + (p.total_score ?? 0), 0) / startedPlayers.length
        : 0

      for (const player of players) {
        const origPrice = origPriceByPlayer.get(player.id) ?? player.current_price
        const totalScore = player.total_score ?? 0
        const fieldRelative = fieldAvgTotal - totalScore  // positive = better than field

        const tier = Math.max(0, Math.min(1, (origPrice - 1) / 15))
        const weight = fieldRelative >= 0
          ? (1.5 - tier)   // outperforming: cheap players rewarded more
          : (0.5 + tier)   // underperforming: expensive players penalised more

        const adj = fieldRelative * weight * 0.4

        // Round to nearest £0.5m, clamp to ±50% of original price (and hard £20m ceiling)
        const floor = Math.round(origPrice * 0.5 * 2) / 2
        const ceiling = Math.min(20, Math.round(origPrice * 1.5 * 2) / 2)
        const newPrice = Math.max(floor, Math.min(ceiling, Math.round((origPrice + adj) * 2) / 2))

        if (newPrice === player.current_price) continue

        const direction = getPriceDirection(player.current_price, newPrice)
        await supabase
          .from('players')
          .update({ current_price: newPrice, price_direction: direction })
          .eq('id', player.id)

        player.current_price = newPrice
      }
    }

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
      if (WD_STATUSES.includes(scoreUpper)) continue

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
        const [{ data: roundScores }, { data: allRoundScores }, { data: roundStartPriceRow }] = await Promise.all([
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
          // Get the price recorded at the start of this round (earliest price_history entry)
          // This is the stable base — we calculate from this, not from the drifting current_price
          supabase
            .from('price_history')
            .select('price')
            .eq('player_id', player.id)
            .eq('round', activeSyncRound)
            .order('hole_number', { ascending: true })
            .limit(1)
            .maybeSingle(),
        ])

        const currentRoundScore = roundScores?.reduce((sum, h) => sum + (h.score_vs_par ?? 0), 0) ?? 0
        const holesCompleted = roundScores?.length ?? 0
        const totalScore = allRoundScores?.reduce((sum, h) => sum + (h.score_vs_par ?? 0), 0) ?? 0

        // Price is handled by the bulk relative-performance pass above.
        // Here we just use current_price (already updated this cycle) to record price_history.
        const newPrice = player.current_price
        const direction = player.price_direction as 'up' | 'down' | 'flat'

        await supabase
          .from('players')
          .update({
            current_round_score: currentRoundScore,
            holes_completed: holesCompleted,
            total_score: totalScore,
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
