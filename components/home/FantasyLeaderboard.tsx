'use client'

import { useState, useEffect } from 'react'

interface Entry {
  userId: string
  displayName: string
  totalScore: number
  holesCompleted: number
  position: number
}

function scoreLabel(s: number) {
  return s === 0 ? 'E' : s > 0 ? `+${s}` : `${s}`
}

export default function FantasyLeaderboard({
  leagueId,
  userId,
}: {
  leagueId: string | null
  userId: string
}) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!leagueId) { setLoading(false); return }
    async function load() {
      const res = await fetch(`/api/leaderboard?leagueId=${leagueId}&round=1`)
      if (res.ok) {
        const data = await res.json()
        setEntries(data.entries ?? [])
      }
      setLoading(false)
    }
    load()
    const interval = setInterval(load, 60_000)
    return () => clearInterval(interval)
  }, [leagueId])

  if (!leagueId) return null
  if (loading) return <div className="px-4 py-3 text-xs text-[#5a7a65]">Loading...</div>

  return (
    <div className="border-b border-[#1a3d2b]">
      <div className="px-4 py-2 bg-[#0f2518]">
        <h2 className="text-sm font-bold text-[#c9a227]">Fantasy Leaderboard</h2>
      </div>
      <div className="divide-y divide-[#1a3d2b]">
        {entries.map((e) => {
          const isMe = e.userId === userId
          return (
            <div
              key={e.userId}
              className={`flex items-center px-4 py-2 gap-3 ${isMe ? 'bg-[#1a3d2b] border-l-2 border-[#c9a227]' : ''}`}
            >
              <span className="text-xs text-[#5a7a65] w-6 text-center">{e.position}</span>
              <span className={`text-sm flex-1 truncate ${isMe ? 'text-[#c9a227] font-bold' : 'text-white'}`}>
                {e.displayName}
              </span>
              <span className="text-[10px] text-[#5a7a65] w-8 text-center">{e.holesCompleted}h</span>
              <span className={`text-sm font-score font-bold w-10 text-right ${e.totalScore < 0 ? 'text-[#4adb7a]' : e.totalScore > 0 ? 'text-[#e05555]' : 'text-white'}`}>
                {scoreLabel(e.totalScore)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
