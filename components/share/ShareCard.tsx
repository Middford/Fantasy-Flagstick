'use client'

import type { Pick, Hole } from '@/lib/supabase/types'

interface Props {
  displayName: string
  tournamentName: string
  round: number
  picks: (Pick & { players?: { name: string; name_full: string } })[]
  holes: Hole[]
  userId: string
}

function scoreLabel(s: number | null): string {
  if (s === null) return '—'
  if (s === 0) return 'E'
  return s > 0 ? `+${s}` : `${s}`
}

function scoreClass(s: number | null, isWater?: boolean): string {
  if (s === null) return 'text-gray-500'
  if (isWater) return 'text-blue-400'
  if (s <= -2) return 'bg-[#c9a227] text-[#0a1a10] rounded-full'
  if (s === -1) return 'bg-[#e05555] text-white rounded-full'
  if (s === 0) return 'text-[#8ab89a]'
  if (s === 1) return 'border border-[#4a90d9] text-[#4a90d9]'
  return 'bg-[#1a2a8b] text-white'
}

export default function ShareCard({ displayName, tournamentName, round, picks, holes, userId }: Props) {
  const pickMap = new Map<number, typeof picks[0]>()
  picks.forEach((p) => pickMap.set(p.hole_number, p))

  const totalScore = picks.reduce((sum, p) => {
    const s = p.score_vs_par ?? 0
    return sum + (p.is_postman ? s * 2 : s)
  }, 0)

  const front9Picks = Array.from({ length: 9 }, (_, i) => pickMap.get(i + 1))
  const back9Picks = Array.from({ length: 9 }, (_, i) => pickMap.get(i + 10))

  async function handleShare() {
    const url = `${window.location.origin}/share/${userId}/${round}`
    if (navigator.share) {
      await navigator.share({
        title: `${displayName}'s Masters Fantasy Scorecard`,
        text: `Check out my Round ${round} picks on Fantasy Flagstick!`,
        url,
      })
    } else {
      await navigator.clipboard.writeText(url)
      alert('Link copied to clipboard!')
    }
  }

  return (
    <div className="w-full max-w-sm">
      {/* Card */}
      <div className="bg-[#1a3d2b] rounded-2xl overflow-hidden border border-[#c9a227]">
        {/* Header */}
        <div className="bg-[#0a1a10] px-4 py-3 border-b border-[#c9a227]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-[#c9a227] uppercase tracking-widest font-bold">
                Fantasy Flagstick
              </p>
              <h1 className="text-lg font-bold text-white">{displayName}</h1>
            </div>
            <div className="text-right">
              <p className="text-xs text-[#8ab89a]">{tournamentName}</p>
              <p className="text-xs text-[#8ab89a]">Round {round}</p>
            </div>
          </div>
        </div>

        {/* Scorecard grid */}
        <div className="p-3">
          {/* Front 9 */}
          <div className="mb-2">
            <p className="text-[10px] text-[#5a7a65] mb-1">Front 9</p>
            <div className="grid grid-cols-9 gap-1">
              {front9Picks.map((pick, i) => {
                const holeNum = i + 1
                const hole = holes.find((h) => h.number === holeNum)
                const isWater = hole?.water_hazard && (pick?.score_vs_par ?? 0) > 1
                return (
                  <div key={holeNum} className="flex flex-col items-center gap-0.5">
                    <span className="text-[8px] text-[#5a7a65]">{holeNum}</span>
                    <div
                      className={`w-7 h-7 flex items-center justify-center text-[11px] font-score font-bold
                        ${isWater ? 'text-[#4a90d9]' : scoreClass(pick?.score_vs_par ?? null)}`}
                    >
                      {isWater ? '🌊' : scoreLabel(pick?.score_vs_par ?? null)}
                    </div>
                    <span className="text-[7px] text-[#5a7a65] truncate w-full text-center">
                      {pick?.players?.name?.split('.')[1]?.trim()?.slice(0, 5) ?? '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Back 9 */}
          <div className="mb-3">
            <p className="text-[10px] text-[#5a7a65] mb-1">Back 9</p>
            <div className="grid grid-cols-9 gap-1">
              {back9Picks.map((pick, i) => {
                const holeNum = i + 10
                const hole = holes.find((h) => h.number === holeNum)
                const isWater = hole?.water_hazard && (pick?.score_vs_par ?? 0) > 1
                return (
                  <div key={holeNum} className="flex flex-col items-center gap-0.5">
                    <span className="text-[8px] text-[#5a7a65]">{holeNum}</span>
                    <div
                      className={`w-7 h-7 flex items-center justify-center text-[11px] font-score font-bold
                        ${isWater ? 'text-[#4a90d9]' : scoreClass(pick?.score_vs_par ?? null)}`}
                    >
                      {isWater ? '🌊' : scoreLabel(pick?.score_vs_par ?? null)}
                    </div>
                    <span className="text-[7px] text-[#5a7a65] truncate w-full text-center">
                      {pick?.players?.name?.split('.')[1]?.trim()?.slice(0, 5) ?? '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Total */}
          <div className="bg-[#0a1a10] rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-[#8ab89a]">Total Score</p>
              <p className={`text-2xl font-score font-bold
                ${totalScore < 0 ? 'text-[#e05555]' : totalScore > 0 ? 'text-[#4a90d9]' : 'text-[#8ab89a]'}`}>
                {scoreLabel(totalScore)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-[#5a7a65]">fantasyflagstick.com</p>
              <p className="text-[10px] text-[#5a7a65]">Share this card to invite friends</p>
            </div>
          </div>
        </div>
      </div>

      {/* Share buttons */}
      <div className="flex gap-3 mt-4">
        <button
          onClick={handleShare}
          className="flex-1 bg-[#c9a227] text-[#0a1a10] font-bold rounded-xl py-3 text-sm"
        >
          📤 Share Card
        </button>
      </div>
    </div>
  )
}
