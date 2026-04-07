'use client'

interface BudgetBarProps {
  remaining: number
  total: number
  holesLeft: number
}

export default function BudgetBar({ remaining, total, holesLeft }: BudgetBarProps) {
  const pct = Math.max(0, Math.min(100, (remaining / total) * 100))
  const avgPerHole = holesLeft > 0 ? remaining / holesLeft : 0
  const isTight = avgPerHole < 4 && holesLeft > 0

  return (
    <div className="bg-[#1a3d2b] px-4 py-3 border-b border-[#2d5c3f]">
      <div className="flex items-center justify-between mb-1.5">
        <div>
          <span className="text-xl font-score font-bold text-white">£{remaining}m</span>
          <span className="text-[#8ab89a] text-xs ml-1.5">remaining of £{total}m</span>
        </div>
        <div className="text-right">
          <div className="text-sm font-score text-[#c9a227]">£{avgPerHole.toFixed(1)}m</div>
          <div className="text-[10px] text-[#5a7a65]">avg / {holesLeft} left</div>
        </div>
      </div>
      {/* Progress bar */}
      <div className="h-1.5 bg-[#0a1a10] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            backgroundColor: pct > 30 ? '#c9a227' : pct > 15 ? '#e8a020' : '#e05555',
          }}
        />
      </div>
      {/* Warning */}
      {isTight && (
        <div className="mt-2 text-xs text-[#e8a020] font-semibold">
          ⚠️ Budget tight — average £{avgPerHole.toFixed(1)}m per hole remaining
        </div>
      )}
    </div>
  )
}
