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

  // Members + picks in parallel
  const [{ data: members }, { data: picks }] = await Promise.all([
    supabase
      .from('league_members')
      .select('user_id, display_name')
      .eq('league_id', leagueId),
    supabase
      .from('picks')
      .select('user_id, score_vs_par, is_postman, hole_number')
      .eq('league_id', leagueId)
      .eq('round', roundNum)
      .not('score_vs_par', 'is', null),
  ])

  if (!members?.length) return NextResponse.json({ entries: [] })

  // Aggregate scores per user
  const userScores = new Map<string, { score: number; holes: number }>()
  picks?.forEach((pick) => {
    const base = pick.score_vs_par ?? 0
    const score = pick.is_postman ? base * 2 : base
    const existing = userScores.get(pick.user_id) ?? { score: 0, holes: 0 }
    userScores.set(pick.user_id, { score: existing.score + score, holes: existing.holes + 1 })
  })

  const entries = members.map((m) => ({
    userId: m.user_id,
    displayName: m.display_name ?? 'Player',
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
