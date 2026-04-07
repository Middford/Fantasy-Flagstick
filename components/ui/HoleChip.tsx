'use client'

interface HoleChipProps {
  holeNumber: number
  par: number
  scoreVsPar?: number | null
  isWater?: boolean
  isPostman?: boolean
  isMulligan?: boolean
  isLocked?: boolean
  isSelected?: boolean
  isLockingSoon?: boolean
  onClick?: () => void
}

function getScoreClass(scoreVsPar: number | null | undefined): string {
  if (scoreVsPar === null || scoreVsPar === undefined) return ''
  if (scoreVsPar <= -2) return 'score-eagle'
  if (scoreVsPar === -1) return 'score-birdie'
  if (scoreVsPar === 0) return 'score-par'
  if (scoreVsPar === 1) return 'score-bogey'
  return 'score-double'
}

function getScoreLabel(scoreVsPar: number | null | undefined): string {
  if (scoreVsPar === null || scoreVsPar === undefined) return ''
  if (scoreVsPar === 0) return 'E'
  return scoreVsPar > 0 ? `+${scoreVsPar}` : `${scoreVsPar}`
}

export default function HoleChip({
  holeNumber,
  scoreVsPar,
  isWater,
  isPostman,
  isMulligan,
  isLocked,
  isSelected,
  isLockingSoon,
  onClick,
}: HoleChipProps) {
  const hasScore = scoreVsPar !== null && scoreVsPar !== undefined

  return (
    <button
      onClick={onClick}
      className={`
        relative flex flex-col items-center justify-center
        w-full h-[52px] rounded-lg text-xs font-bold transition-all
        ${isSelected
          ? 'bg-[#1a3d2b] border-2 border-[#c9a227] scale-105'
          : 'bg-[#1a3d2b] border border-[#2d5c3f]'}
        ${isPostman ? 'border-[#d63030] border-2' : ''}
        ${isMulligan ? 'border-[#20a090] border-2' : ''}
        ${isLockingSoon ? 'border-[#e8a020] border-2 animate-pulse' : ''}
        ${isLocked ? 'opacity-70' : ''}
      `}
      aria-label={`Hole ${holeNumber}`}
    >
      {/* Badges top-left */}
      {isPostman && (
        <span className="absolute -top-1 -left-1 text-[8px] bg-[#d63030] rounded-full w-3.5 h-3.5 flex items-center justify-center">
          P
        </span>
      )}
      {isMulligan && (
        <span className="absolute -top-1 -left-1 text-[8px] bg-[#20a090] rounded-full w-3.5 h-3.5 flex items-center justify-center">
          M
        </span>
      )}
      {/* Lock badge top-right */}
      {isLocked && (
        <span className="absolute -top-1 -right-1 text-[8px]">🔒</span>
      )}

      {/* Hole number */}
      <span className="text-[#8ab89a] text-[10px] leading-none">{holeNumber}</span>

      {/* Score or water */}
      {isWater ? (
        <span className="text-base leading-none mt-0.5">🌊</span>
      ) : hasScore ? (
        <span
          className={`text-[13px] font-score leading-none mt-0.5 w-6 h-6 flex items-center justify-center ${getScoreClass(scoreVsPar)}`}
        >
          {getScoreLabel(scoreVsPar)}
        </span>
      ) : (
        <span className="text-[#5a7a65] text-[10px] mt-0.5">—</span>
      )}
    </button>
  )
}
