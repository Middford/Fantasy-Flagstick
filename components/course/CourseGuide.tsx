'use client'

import { useState } from 'react'
import type { Hole } from '@/lib/supabase/types'

// Augusta National hole character descriptions
const HOLE_NOTES: Record<number, string> = {
  1:  'A demanding opener with a dogleg-right fairway. Bunkers right punish the aggressive drive.',
  2:  'Long par 5 with a bunker-lined fairway. Reachable in two for the longest hitters.',
  3:  'Short par 4 but deceptively tricky — approach must avoid greenside bunkers on all sides.',
  4:  'Downhill par 3 to a severely sloped green. One of Augusta\'s toughest tee shots.',
  5:  'Long par 4 playing into a tree-lined corridor. Bunkers left off the tee are punishing.',
  6:  'Uphill par 3 where the green tilts severely left-to-right. Par is always a good score.',
  7:  'Short par 4 that rewards precise iron play. Left-side pins hide behind steep run-offs.',
  8:  'Uphill par 5 with a blind second shot over a ridge. One of Augusta\'s most dramatic.',
  9:  'Downhill par 4 finishing the front nine. A green that slopes hard left punishes right misses.',
  10: 'The longest driving hole at Augusta — dramatic downhill with a fairway bunker right.',
  11: 'Amen Corner begins. A pond guards the entire left side. Miss right, not left.',
  12: 'The most famous short hole in golf. Wind swirls unpredictably over Rae\'s Creek.',
  13: 'Amen Corner\'s par 5 climax. Eagles possible; the creek collects anything short-left.',
  14: 'The only hole at Augusta without a bunker. Subtle undulations make every approach hard.',
  15: 'The pond in front of the green makes this par 5 the tournament\'s hinge point.',
  16: 'All carry across the pond. Players have made aces and doubles in the same Masters.',
  17: 'A par 4 where placement off the tee defines your angle. The back bunker is a graveyard.',
  18: 'The closing climb past the famous oak tree. Bunkers left demand a controlled draw.',
}

function parColour(par: number): string {
  if (par === 3) return 'text-[#4a90d9]'
  if (par === 5) return 'text-[#4adb7a]'
  return 'text-white'
}

interface Props {
  holes: Hole[]
}

export default function CourseGuide({ holes }: Props) {
  const [expanded, setExpanded] = useState(false)

  const sorted = [...holes].sort((a, b) => a.number - b.number)

  return (
    <div className="border-b border-[#1a3d2b]">
      {/* Toggle header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-bold text-[#8ab89a] uppercase tracking-wide">
          ⛳ Course Guide — Augusta National
        </span>
        <span className="text-[#5a7a65] text-lg">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="divide-y divide-[#1a3d2b]">
          {sorted.map((hole) => (
            <div key={hole.number} className="px-4 py-3">
              <div className="flex items-start gap-3">
                {/* Hole number badge */}
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#1a3d2b] flex flex-col items-center justify-center border border-[#2d5c3f]">
                  <span className="text-[9px] text-[#5a7a65] uppercase leading-none">Hole</span>
                  <span className="text-sm font-bold text-white leading-tight">{hole.number}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm font-bold text-[#c9a227]">{hole.name || `Hole ${hole.number}`}</span>
                    <span className={`text-xs font-bold ${parColour(hole.par)}`}>Par {hole.par}</span>
                    <span className="text-xs text-[#5a7a65]">{hole.yards} yds</span>
                    {hole.water_hazard && (
                      <span className="text-xs text-[#4a90d9]">🌊</span>
                    )}
                  </div>

                  {/* Stats row */}
                  <div className="flex gap-3 mt-1 text-[11px] text-[#8ab89a]">
                    {hole.birdie_pct != null && (
                      <span>🐦 {hole.birdie_pct}% birdie</span>
                    )}
                    {hole.eagle_pct != null && hole.eagle_pct > 0 && (
                      <span>🦅 {hole.eagle_pct}% eagle</span>
                    )}
                    {hole.bogey_pct != null && (
                      <span>📍 {hole.bogey_pct}% bogey</span>
                    )}
                    {hole.difficulty_rank != null && (
                      <span className="text-[#5a7a65]">#{hole.difficulty_rank} hardest</span>
                    )}
                  </div>

                  {/* Hole note */}
                  {HOLE_NOTES[hole.number] && (
                    <p className="text-[11px] text-[#5a7a65] mt-1.5 leading-snug">
                      {HOLE_NOTES[hole.number]}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Amen Corner callout */}
          <div className="px-4 py-3 bg-[#0f2518]">
            <p className="text-[11px] text-[#c9a227] font-bold">⛳ Amen Corner: Holes 11–13</p>
            <p className="text-[10px] text-[#5a7a65] mt-0.5">
              The stretch where the Masters is so often won and lost. Water, wind, and pressure combine.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
