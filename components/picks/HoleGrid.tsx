'use client'

import type { Hole, Pick } from '@/lib/supabase/types'
import HoleChip from '@/components/ui/HoleChip'

interface HoleGridProps {
  holes: Hole[]
  picks: Pick[]
  selectedHole: number
  postmanPlayerId: string | null
  onSelectHole: (holeNumber: number) => void
}

export default function HoleGrid({
  holes,
  picks,
  selectedHole,
  postmanPlayerId,
  onSelectHole,
}: HoleGridProps) {
  const pickMap = new Map<number, Pick>()
  picks.forEach((p) => pickMap.set(p.hole_number, p))

  const front9 = holes.filter((h) => h.number <= 9).sort((a, b) => a.number - b.number)
  const back9 = holes.filter((h) => h.number >= 10).sort((a, b) => a.number - b.number)

  const renderRow = (rowHoles: Hole[]) => (
    <div className="flex gap-1.5">
      {rowHoles.map((hole) => {
        const pick = pickMap.get(hole.number)
        const isPostman = pick?.player_id === postmanPlayerId && postmanPlayerId !== null

        return (
          <HoleChip
            key={hole.number}
            holeNumber={hole.number}
            par={hole.par}
            scoreVsPar={pick?.score_vs_par}
            isWater={pick?.score_vs_par !== null && hole.water_hazard && (pick?.score_vs_par ?? 0) > 1}
            isPostman={isPostman}
            isMulligan={pick?.is_mulligan_used}
            isLocked={pick?.is_locked}
            isSelected={selectedHole === hole.number}
            onClick={() => onSelectHole(hole.number)}
          />
        )
      })}
    </div>
  )

  return (
    <div className="px-4 py-3 border-b border-[#1a3d2b]">
      <div className="flex flex-col gap-2">
        {/* Front 9 */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#5a7a65] w-4 text-center">F</span>
          {renderRow(front9)}
        </div>
        {/* Back 9 */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#5a7a65] w-4 text-center">B</span>
          {renderRow(back9)}
        </div>
      </div>
    </div>
  )
}
