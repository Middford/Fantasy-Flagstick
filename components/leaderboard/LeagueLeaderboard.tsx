'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronRight } from 'lucide-react'

interface League {
  id: string
  name: string
  code: string
  type: string
}

interface LeaderboardEntry {
  userId: string
  displayName: string
  totalScore: number
  holesCompleted: number
  position: number
}

interface Props {
  leagues: League[]
  tournamentId: string
  round: number
  userId: string
}

function scoreLabel(s: number) {
  if (s === 0) return 'E'
  return s > 0 ? `+${s}` : `${s}`
}

function LeagueSection({
  league,
  tournamentId,
  round,
  userId,
}: {
  league: League
  tournamentId: string
  round: number
  userId: string
}) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])

  useEffect(() => {
    const supabase = createClient()

    async function buildLeaderboard() {
      // Get all members
      const { data: members } = await supabase
        .from('league_members')
        .select('user_id, display_name')
        .eq('league_id', league.id)

      if (!members?.length) return

      // Get all picks with scores
      const { data: picks } = await supabase
        .from('picks')
        .select('user_id, score_vs_par, is_postman, player_id, is_locked')
        .eq('league_id', league.id)
        .eq('round', round)
        .not('score_vs_par', 'is', null)

      // Aggregate per user
      const userScores = new Map<string, { score: number; holes: number }>()
      picks?.forEach((pick) => {
        const base = pick.score_vs_par ?? 0
        const score = pick.is_postman ? base * 2 : base
        const existing = userScores.get(pick.user_id) ?? { score: 0, holes: 0 }
        userScores.set(pick.user_id, {
          score: existing.score + score,
          holes: existing.holes + 1,
        })
      })

      const result: LeaderboardEntry[] = members.map((m) => ({
        userId: m.user_id,
        displayName: m.display_name ?? 'Player',
        totalScore: userScores.get(m.user_id)?.score ?? 0,
        holesCompleted: userScores.get(m.user_id)?.holes ?? 0,
        position: 0,
      }))

      // Sort and assign positions
      result.sort((a, b) => {
        if (a.totalScore !== b.totalScore) return a.totalScore - b.totalScore
        return b.holesCompleted - a.holesCompleted
      })
      result.forEach((e, i) => { e.position = i + 1 })

      setEntries(result)
    }

    buildLeaderboard()

    // Realtime picks updates
    const channel = supabase
      .channel(`leaderboard-${league.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'picks' }, buildLeaderboard)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [league.id, round])

  return (
    <div className="mb-4">
      <div className="px-4 py-2 bg-[#1a3d2b] border-y border-[#2d5c3f]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">{league.name}</h2>
            {league.type !== 'global' && (
              <p className="text-[10px] text-[#8ab89a]">Code: {league.code}</p>
            )}
          </div>
          <span className="text-[10px] text-[#5a7a65]">{entries.length} players</span>
        </div>
      </div>

      <div className="divide-y divide-[#1a3d2b]">
        {entries.map((entry) => (
          <div
            key={entry.userId}
            className={`flex items-center gap-3 px-4 py-3
              ${entry.userId === userId ? 'border-l-2 border-[#c9a227] bg-[#0f2518]' : ''}`}
          >
            <span className="font-score text-sm text-[#8ab89a] w-5 text-center">
              {entry.position}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {entry.displayName}
                {entry.userId === userId && (
                  <span className="ml-1.5 text-[10px] text-[#c9a227]">You</span>
                )}
              </p>
              <p className="text-[10px] text-[#5a7a65]">
                {entry.holesCompleted} holes
              </p>
            </div>
            <span
              className={`font-score text-base font-bold
                ${entry.totalScore < 0 ? 'text-[#e05555]'
                : entry.totalScore > 0 ? 'text-[#4a90d9]'
                : 'text-[#8ab89a]'}`}
            >
              {scoreLabel(entry.totalScore)}
            </span>
            <ChevronRight size={14} className="text-[#5a7a65]" />
          </div>
        ))}

        {entries.length === 0 && (
          <div className="px-4 py-6 text-center text-[#5a7a65] text-sm">
            Leaderboard updates as holes complete
          </div>
        )}
      </div>
    </div>
  )
}

export default function LeagueLeaderboard({ leagues, tournamentId, round, userId }: Props) {
  return (
    <div className="flex flex-col">
      {leagues.map((league) => (
        <LeagueSection
          key={league.id}
          league={league}
          tournamentId={tournamentId}
          round={round}
          userId={userId}
        />
      ))}
    </div>
  )
}
