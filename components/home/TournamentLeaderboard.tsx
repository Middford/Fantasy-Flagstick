'use client'

import { useState, useEffect } from 'react'

interface PlayerEntry {
  position: string
  name: string
  total: string
  thru: string
  status: string
}

export default function TournamentLeaderboard() {
  const [players, setPlayers] = useState<PlayerEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/masters-leaderboard')
        if (res.ok) {
          const data = await res.json()
          setPlayers(data.entries ?? [])
        }
      } catch { /* retry next cycle */ }
      setLoading(false)
    }
    load()
    const interval = setInterval(load, 60_000)
    return () => clearInterval(interval)
  }, [])

  if (loading) return <div className="px-4 py-3 text-xs text-[#5a7a65]">Loading...</div>

  return (
    <div className="border-b border-[#1a3d2b]">
      <div className="px-4 py-2 bg-[#0f2518]">
        <h2 className="text-sm font-bold text-[#c9a227]">Masters Leaderboard</h2>
      </div>
      {/* Header */}
      <div className="flex items-center px-4 py-1.5 text-[10px] text-[#5a7a65] uppercase tracking-wider">
        <span className="w-6 text-center">Pos</span>
        <span className="flex-1 ml-3">Player</span>
        <span className="w-10 text-center">Thru</span>
        <span className="w-10 text-right">Total</span>
      </div>
      <div className="divide-y divide-[#1a3d2b]">
        {players.slice(0, 20).map((p, i) => {
          const totalNum = p.total === 'E' ? 0 : parseInt(p.total) || 0
          const isCut = p.status === 'cut'
          return (
            <div
              key={i}
              className={`flex items-center px-4 py-1.5 ${isCut ? 'opacity-40' : ''}`}
            >
              <span className="text-xs text-[#5a7a65] w-6 text-center">{p.position}</span>
              <span className="text-xs text-white flex-1 ml-3 truncate">{p.name}</span>
              <span className="text-[10px] text-[#5a7a65] w-10 text-center">{p.thru}</span>
              <span className={`text-xs font-score font-bold w-10 text-right ${totalNum < 0 ? 'text-[#4adb7a]' : totalNum > 0 ? 'text-[#e05555]' : 'text-white'}`}>
                {p.total}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
