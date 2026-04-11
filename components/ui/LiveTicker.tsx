'use client'

import { useState, useEffect } from 'react'

interface LivePick {
  playerName: string
  holeNumber: number
}

export default function LiveTicker({ picks }: { picks: LivePick[] }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (picks.length <= 1) return
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % picks.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [picks.length])

  if (picks.length === 0) return null

  const current = picks[index]

  return (
    <div className="px-4 py-2 bg-[#1a2a10] border-b border-[#2d5c3f] overflow-hidden">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#e8a020] animate-pulse flex-shrink-0" />
        <p className="text-xs text-[#e8a020] font-medium truncate transition-all duration-500">
          {current.playerName} on Hole {current.holeNumber}
        </p>
        {picks.length > 1 && (
          <span className="text-[10px] text-[#5a7a65] flex-shrink-0">
            {index + 1}/{picks.length}
          </span>
        )}
      </div>
    </div>
  )
}
