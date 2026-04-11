'use client'

interface LivePillProps {
  round?: number
  // true = actively playing, false = between rounds / complete
  isLive?: boolean
}

export default function LivePill({ round, isLive = true }: LivePillProps) {
  if (!isLive) {
    return (
      <div className="flex items-center gap-1.5 bg-[#1a3d2b] rounded-full px-2.5 py-1">
        <span className="w-1.5 h-1.5 rounded-full bg-[#5a7a65]" />
        <span className="text-[11px] font-semibold text-[#5a7a65] uppercase tracking-wide">
          {round ? `R${round}` : 'Done'}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 bg-[#1a3d2b] rounded-full px-2.5 py-1">
      <span className="w-1.5 h-1.5 rounded-full bg-[#e05555] animate-pulse" />
      <span className="text-[11px] font-semibold text-[#8ab89a] uppercase tracking-wide">
        {round ? `R${round} Live` : 'Live'}
      </span>
    </div>
  )
}
