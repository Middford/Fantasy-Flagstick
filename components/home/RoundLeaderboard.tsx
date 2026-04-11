'use client'

import { useState, useEffect } from 'react'

interface PlayerRound {
  name: string
  roundScore: number
  holesCompleted: number
  totalScore: string
}

function scoreLabel(s: number) {
  return s === 0 ? 'E' : s > 0 ? `+${s}` : `${s}`
}

export default function RoundLeaderboard({
  tournamentId,
  currentRound,
}: {
  tournamentId: string
  currentRound: number
}) {
  const [players, setPlayers] = useState<PlayerRound[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        // Fetch from ESPN — get per-round scores
        const res = await fetch('/api/masters-leaderboard')
        if (!res.ok) return
        const data = await res.json()
        const entries = data.entries ?? []

        // We also need round-specific data — the masters-leaderboard API returns total + thru
        // For round-specific, we need to fetch from ESPN scoreboard directly
        const espnRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard')
        if (!espnRes.ok) return
        const sb = await espnRes.json()
        const event = sb.events?.find((e: { name: string }) => e.name.toLowerCase().includes('masters'))
        const competitors = event?.competitions?.[0]?.competitors ?? []

        const roundData: PlayerRound[] = []
        for (const c of competitors) {
          const name = c.athlete?.displayName ?? 'Unknown'
          const totalStr = c.score ?? 'E'
          const roundEntry = (c.linescores ?? []).find((ls: { period: number }) => ls.period === currentRound)
          if (!roundEntry) continue

          const roundTotal = roundEntry.value ?? 0
          const roundScore = roundTotal - 72 // Augusta par = 72
          const holeScores = (roundEntry.linescores ?? []).filter(
            (h: { value?: number; displayValue?: string }) => {
              const v = h.displayValue ?? (h.value != null ? String(Math.round(h.value)) : undefined)
              return v && v !== '-' && v !== '--' && !isNaN(parseInt(v, 10))
            }
          )
          const holesCompleted = holeScores.length
          if (holesCompleted === 0) continue

          roundData.push({ name, roundScore, holesCompleted, totalScore: totalStr })
        }

        // Sort by round score (best first), then by holes completed (more = higher)
        roundData.sort((a, b) => a.roundScore !== b.roundScore ? a.roundScore - b.roundScore : b.holesCompleted - a.holesCompleted)
        setPlayers(roundData)
      } catch { /* retry next cycle */ }
      setLoading(false)
    }
    load()
    const interval = setInterval(load, 60_000)
    return () => clearInterval(interval)
  }, [currentRound])

  if (loading) return <div className="px-4 py-3 text-xs text-[#5a7a65]">Loading...</div>
  if (players.length === 0) return null

  return (
    <div className="border-b border-[#1a3d2b]">
      <div className="px-4 py-2 bg-[#0f2518]">
        <h2 className="text-sm font-bold text-[#c9a227]">Round {currentRound} Scores</h2>
      </div>
      <div className="flex items-center px-4 py-1.5 text-[10px] text-[#5a7a65] uppercase tracking-wider">
        <span className="w-6 text-center">#</span>
        <span className="flex-1 ml-3">Player</span>
        <span className="w-10 text-center">Thru</span>
        <span className="w-10 text-center">Today</span>
        <span className="w-10 text-right">Total</span>
      </div>
      <div className="divide-y divide-[#1a3d2b]">
        {players.slice(0, 20).map((p, i) => {
          const totalNum = p.totalScore === 'E' ? 0 : parseInt(p.totalScore) || 0
          return (
            <div key={i} className="flex items-center px-4 py-1.5">
              <span className="text-xs text-[#5a7a65] w-6 text-center">{i + 1}</span>
              <span className="text-xs text-white flex-1 ml-3 truncate">{p.name}</span>
              <span className="text-[10px] text-[#5a7a65] w-10 text-center">
                {p.holesCompleted === 18 ? 'F' : p.holesCompleted}
              </span>
              <span className={`text-xs font-score font-bold w-10 text-center ${p.roundScore < 0 ? 'text-[#4adb7a]' : p.roundScore > 0 ? 'text-[#e05555]' : 'text-white'}`}>
                {scoreLabel(p.roundScore)}
              </span>
              <span className={`text-xs font-score w-10 text-right ${totalNum < 0 ? 'text-[#4adb7a]' : totalNum > 0 ? 'text-[#e05555]' : 'text-white'}`}>
                {p.totalScore}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
