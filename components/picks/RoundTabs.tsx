'use client'

import { useRouter, useSearchParams } from 'next/navigation'

interface RoundTabsProps {
  currentRound: number
  selectedRound: number
  availableRounds: number[]
}

export default function RoundTabs({ currentRound, selectedRound, availableRounds }: RoundTabsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function selectRound(round: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('round', String(round))
    router.push(`/picks?${params.toString()}`)
  }

  const labels: Record<number, string> = { 1: 'R1', 2: 'R2', 3: 'R3', 4: 'R4' }

  return (
    <div className="flex gap-1 px-4 py-2 bg-[#0a1a10] border-b border-[#1a3d2b]">
      {availableRounds.map((r) => {
        const isActive = r === selectedRound
        const isLive = r === currentRound
        return (
          <button
            key={r}
            onClick={() => selectRound(r)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors
              ${isActive
                ? 'bg-[#c9a227] text-[#0a1a10]'
                : 'bg-[#1a3d2b] text-[#8ab89a] hover:text-white'}`}
          >
            {labels[r]}
            {isLive && <span className="ml-1 text-[9px] opacity-75">LIVE</span>}
          </button>
        )
      })}
    </div>
  )
}
