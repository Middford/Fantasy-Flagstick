'use client'

import { useState, useEffect } from 'react'
import MemberTeamSheet from './MemberTeamSheet'

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
  round,
  userId,
}: {
  league: League
  round: number
  userId: string
}) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [sheet, setSheet] = useState<{ userId: string; displayName: string } | null>(null)

  async function fetchLeaderboard() {
    const res = await fetch(`/api/leaderboard?leagueId=${league.id}&round=${round}`)
    if (res.ok) {
      const data = await res.json()
      setEntries(data.entries ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchLeaderboard()
    const interval = setInterval(fetchLeaderboard, 30_000)
    return () => clearInterval(interval)
  }, [league.id, round]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
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
          {loading ? (
            <div className="px-4 py-6 text-center text-[#5a7a65] text-sm">Loading...</div>
          ) : entries.length === 0 ? (
            <div className="px-4 py-6 text-center text-[#5a7a65] text-sm">
              Leaderboard updates as holes complete
            </div>
          ) : (
            entries.map((entry) => (
              <button
                key={entry.userId}
                onClick={() => setSheet({ userId: entry.userId, displayName: entry.displayName })}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left active:bg-[#1a3d2b] transition-colors
                  ${entry.userId === userId ? 'border-l-2 border-[#c9a227] bg-[#0f2518]' : ''}`}
              >
                <span className="font-score text-sm text-[#8ab89a] w-5 text-center flex-shrink-0">
                  {entry.position}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {entry.displayName}
                    {entry.userId === userId && (
                      <span className="ml-1.5 text-[10px] text-[#c9a227]">You</span>
                    )}
                  </p>
                  <p className="text-[10px] text-[#5a7a65]">{entry.holesCompleted} holes</p>
                </div>
                <span
                  className={`font-score text-base font-bold flex-shrink-0
                    ${entry.totalScore < 0 ? 'text-[#4adb7a]'
                    : entry.totalScore > 0 ? 'text-[#e05555]'
                    : 'text-[#8ab89a]'}`}
                >
                  {scoreLabel(entry.totalScore)}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {sheet && (
        <MemberTeamSheet
          leagueId={league.id}
          targetUserId={sheet.userId}
          displayName={sheet.displayName}
          round={round}
          onClose={() => setSheet(null)}
        />
      )}
    </>
  )
}

export default function LeagueLeaderboard({ leagues, tournamentId, round, userId }: Props) {
  return (
    <div className="flex flex-col">
      {leagues.map((league) => (
        <LeagueSection
          key={league.id}
          league={league}
          round={round}
          userId={userId}
        />
      ))}
    </div>
  )
}
