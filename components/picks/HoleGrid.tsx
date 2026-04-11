'use client'

import type { Hole, Pick, Player } from '@/lib/supabase/types'
import HoleChip from '@/components/ui/HoleChip'

interface HoleGridProps {
  holes: Hole[]
  picks: Pick[]
  players: Player[]
  selectedHole: number
  postmanPlayerId: string | null
  onSelectHole: (holeNumber: number) => void
}

export default function HoleGrid({
  holes,
  picks,
  players,
  selectedHole,
  postmanPlayerId,
  onSelectHole,
}: HoleGridProps) {
  const pickMap = new Map<number, Pick>()
  picks.forEach((p) => pickMap.set(p.hole_number, p))

  const playerMap = new Map<string, Player>()
  players.forEach((p) => playerMap.set(p.id, p))

  const sorted = [...holes].sort((a, b) => a.number - b.number)
  // Three rows of 6
  const rows = [
    sorted.filter((h) => h.number <= 6),
    sorted.filter((h) => h.number >= 7 && h.number <= 12),
    sorted.filter((h) => h.number >= 13),
  ]

  return (
    <div className="px-3 py-3 border-b border-[#1a3d2b] flex flex-col gap-1.5">
      {rows.map((rowHoles, rowIdx) => (
        <div key={rowIdx} className="flex gap-1.5">
          {rowHoles.map((hole) => {
            const pick = pickMap.get(hole.number)
            const isPostman = pick?.is_postman === true

            return (
              <div key={hole.number} className="flex-1">
                <HoleChip
                  holeNumber={hole.number}
                  par={hole.par}
                  scoreVsPar={pick?.score_vs_par}
                  isWater={pick?.score_vs_par !== null && hole.water_hazard && (pick?.score_vs_par ?? 0) > 1}
                  isPostman={isPostman}
                  isMulligan={pick?.is_mulligan_used}
                  isLocked={pick?.is_locked}
                  isSelected={selectedHole === hole.number}
                  playerName={pick ? (playerMap.get(pick.player_id)?.name ?? null) : null}
                  pricePaid={pick?.price_paid ?? null}
                  onClick={() => onSelectHole(hole.number)}
                />
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
