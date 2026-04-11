// Fantasy Flagstick — League Leaderboard API
// Browser client can't read picks/members (RLS). This route uses service client.

import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/** Derive a display name from a Clerk User object */
function clerkDisplayName(user: { firstName?: string | null; lastName?: string | null; emailAddresses?: { emailAddress: string }[] }): string {
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ')
  if (full) return full
  const email = user.emailAddresses?.[0]?.emailAddress
  if (email) return email.split('@')[0]
  return 'Player'
}

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const leagueId = searchParams.get('leagueId')
  const round = searchParams.get('round')

  if (!leagueId || !round) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const supabase = createServiceClient()

  // Members, ALL picks (all rounds), and chips in parallel
  // round param is kept for API compatibility but scores are aggregated across all rounds
  const [{ data: members }, { data: picks }, { data: chipsRows }] = await Promise.all([
    supabase
      .from('league_members')
      .select('user_id, display_name')
      .eq('league_id', leagueId),
    supabase
      .from('picks')
      .select('user_id, player_id, score_vs_par, round, hole_number, is_postman')
      .eq('league_id', leagueId),
    supabase
      .from('chips')
      .select('user_id, postman_r1_player_id, postman_r2_player_id, postman_r3_player_id, postman_r4_player_id')
      .eq('league_id', leagueId),
  ])

  if (!members?.length) return NextResponse.json({ entries: [] })

  // Build a map of known names from league_members
  const nameMap = new Map<string, string>()
  members.forEach((m) => {
    if (m.display_name) nameMap.set(m.user_id, m.display_name)
  })

  // For any member still missing a name, fetch from Clerk Backend API (authoritative source)
  const missingIds = members.filter((m) => !nameMap.has(m.user_id)).map((m) => m.user_id)
  if (missingIds.length > 0) {
    try {
      const clerk = await clerkClient()
      const { data: clerkUsers } = await clerk.users.getUserList({ userId: missingIds, limit: 100 })
      for (const u of clerkUsers) {
        const name = clerkDisplayName(u)
        nameMap.set(u.id, name)
        // Backfill league_members so future calls don't need to hit Clerk
        await supabase
          .from('league_members')
          .update({ display_name: name })
          .eq('league_id', leagueId)
          .eq('user_id', u.id)
          .is('display_name', null)
      }
    } catch {
      // Clerk call failed — fall back to 'Player' for affected members
    }
  }

  // Aggregate scores across ALL rounds — Postman doubles the one flagged pick
  // Track which holes each user has confirmed picks for (to penalize gaps)
  const userScores = new Map<string, { score: number; holes: number }>()
  const userHolesByRound = new Map<string, Map<number, Set<number>>>() // userId → round → Set<holeNumber>
  picks?.forEach((pick) => {
    // Only count confirmed scores toward total; null = not yet scored
    if (pick.score_vs_par != null) {
      const base = pick.score_vs_par
      const score = pick.is_postman ? base * 2 : base
      const existing = userScores.get(pick.user_id) ?? { score: 0, holes: 0 }
      userScores.set(pick.user_id, { score: existing.score + score, holes: existing.holes + 1 })
    }

    // Track ALL picked holes per round (including unscored) for penalty calculation
    if (!userHolesByRound.has(pick.user_id)) userHolesByRound.set(pick.user_id, new Map())
    const byRound = userHolesByRound.get(pick.user_id)!
    if (!byRound.has(pick.round)) byRound.set(pick.round, new Set())
    byRound.get(pick.round)!.add(pick.hole_number)
  })

  // Penalty: +2 (double bogey) for each unpicked hole in rounds where the user has picks
  userHolesByRound.forEach((byRound, usrId) => {
    const existing = userScores.get(usrId) ?? { score: 0, holes: 0 }
    byRound.forEach((holes) => {
      const missed = 18 - holes.size
      if (missed > 0) {
        existing.score += missed * 2
        existing.holes += missed
      }
    })
    userScores.set(usrId, existing)
  })

  const entries = members.map((m) => ({
    userId: m.user_id,
    displayName: nameMap.get(m.user_id) ?? 'Player',
    totalScore: userScores.get(m.user_id)?.score ?? 0,
    holesCompleted: userScores.get(m.user_id)?.holes ?? 0,
  }))

  entries.sort((a, b) => {
    if (a.totalScore !== b.totalScore) return a.totalScore - b.totalScore
    return b.holesCompleted - a.holesCompleted
  })

  return NextResponse.json({
    entries: entries.map((e, i) => ({ ...e, position: i + 1 })),
  })
}
