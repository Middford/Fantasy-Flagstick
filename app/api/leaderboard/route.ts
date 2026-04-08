// Fantasy Flagstick — League Leaderboard API
// Browser client can't read picks/members (RLS). This route uses service client.

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const leagueId = searchParams.get('leagueId')
  const round = searchParams.get('round')

  if (!leagueId || !round) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const supabase = createServiceClient()
  const roundNum = parseInt(round, 10)

  // Members, picks, and chips in parallel
  const [{ data: members }, { data: picks }, { data: chipsRows }] = await Promise.all([
    supabase
      .from('league_members')
      .select('user_id, display_name')
      .eq('league_id', leagueId),
    supabase
      .from('picks')
      .select('user_id, player_id, score_vs_par, hole_number')
      .eq('league_id', leagueId)
      .eq('round', roundNum)
      .not('score_vs_par', 'is', null),
    supabase
      .from('chips')
      .select('user_id, postman_r1_player_id, postman_r2_player_id, postman_r3_player_id, postman_r4_player_id')
      .eq('league_id', leagueId),
  ])

  if (!members?.length) return NextResponse.json({ entries: [] })

  // Backfill display names from profiles for any member with a null league_members.display_name
  const missingNameIds = members.filter((m) => !m.display_name).map((m) => m.user_id)
  const profileNameMap = new Map<string, string>()
  if (missingNameIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', missingNameIds)
    profiles?.forEach((p) => {
      if (p.display_name) profileNameMap.set(p.id, p.display_name)
    })
  }

  // Build postman lookup: user_id → player_id for this round
  const postmanMap = new Map<string, string | null>()
  const postmanCol = `postman_r${roundNum}_player_id` as
    | 'postman_r1_player_id'
    | 'postman_r2_player_id'
    | 'postman_r3_player_id'
    | 'postman_r4_player_id'
  chipsRows?.forEach((c) => {
    postmanMap.set(c.user_id, c[postmanCol] ?? null)
  })

  // Aggregate scores per user — Postman doubling from chips table
  const userScores = new Map<string, { score: number; holes: number }>()
  picks?.forEach((pick) => {
    const base = pick.score_vs_par ?? 0
    const postmanPlayerId = postmanMap.get(pick.user_id) ?? null
    const isPostman = postmanPlayerId !== null && pick.player_id === postmanPlayerId
    const score = isPostman ? base * 2 : base
    const existing = userScores.get(pick.user_id) ?? { score: 0, holes: 0 }
    userScores.set(pick.user_id, { score: existing.score + score, holes: existing.holes + 1 })
  })

  const entries = members.map((m) => ({
    userId: m.user_id,
    // Preference: league_members.display_name → profiles.display_name → 'Player'
    displayName: m.display_name || profileNameMap.get(m.user_id) || 'Player',
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
