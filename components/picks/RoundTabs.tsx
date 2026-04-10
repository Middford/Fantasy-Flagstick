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
        const isSelected = r === selectedRound
        const isLive = r === currentRound
        const isCompleted = r < currentRound

        let className = 'px-4 py-1.5 rounded-lg text-xs font-bold transition-colors '

        if (isSelected && isLive) {
          // Current live round, currently viewing
          className += 'bg-[#c9a227] text-[#0a1a10]'
        } else if (isSelected && isCompleted) {
          // Past round, currently viewing
          className += 'bg-[#2d5c3f] text-white'
        } else if (isLive) {
          // Current live round, not viewing — draw attention
          className += 'bg-[#1a3d2b] text-[#4adb7a] border border-[#4adb7a]/40 hover:text-white'
        } else if (isCompleted) {
          // Completed past round, not viewing
          className += 'bg-[#1a3d2b]/60 text-[#5a7a65] hover:text-[#8ab89a]'
        } else {
          // Default (shouldn't occur with new availableRounds logic)
          className += 'bg-[#1a3d2b] text-[#8ab89a] hover:text-white'
        }

        return (
          <button
            key={r}
            onClick={() => selectRound(r)}
            className={className}
          >
            {isCompleted && !isSelected && <span className="mr-1 text-[9px]">✓</span>}
            {labels[r]}
            {isLive && <span className="ml-1 text-[9px] opacity-75">LIVE</span>}
          </button>
        )
      })}
    </div>
  )
}
