'use client'

interface HoleChipProps {
  holeNumber: number
  par: number
  scoreVsPar?: number | null
  playerName?: string | null
  pricePaid?: number | null
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
  playerName,
  pricePaid,
  isWater,
  isPostman,
  isMulligan,
  isLocked,
  isSelected,
  isLockingSoon,
  onClick,
}: HoleChipProps) {
  const hasScore = scoreVsPar !== null && scoreVsPar !== undefined
  const hasPick = playerName != null

  // Show just the surname for compactness: "S. Scheffler" → "Scheffler"
  const surname = playerName
    ? (playerName.includes(' ') ? playerName.split(' ').slice(1).join(' ') : playerName)
    : null

  return (
    <button
      onClick={onClick}
      className={`
        relative flex flex-col items-center justify-center gap-0.5
        w-full h-[72px] rounded-lg font-bold transition-all px-0.5
        ${isLocked
          ? 'bg-[#06100a] border border-[#1a3d2b]'
          : isSelected
          ? 'bg-[#1a3d2b] border-2 border-[#c9a227] scale-105'
          : hasPick
          ? 'bg-[#1a3d2b] border border-[#3a6b4a]'
          : 'bg-[#0f2518] border border-[#1a3d2b]'}
        ${isPostman ? '!border-[#d63030] !border-2' : ''}
        ${isMulligan ? '!border-[#20a090] !border-2' : ''}
        ${isLockingSoon ? '!border-[#e8a020] !border-2 animate-pulse' : ''}
      `}
      aria-label={`Hole ${holeNumber}`}
    >
      {/* Badges */}
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
      {isLocked && (
        <span className="absolute -top-1 -right-1 text-[8px]">🔒</span>
      )}

      {/* Hole number */}
      <span className={`text-[9px] leading-none ${isLocked ? 'text-[#3a5a45]' : 'text-[#5a7a65]'}`}>
        {holeNumber}
      </span>

      {/* Player name — surname only, truncated */}
      {surname ? (
        <span className={`text-[8px] leading-tight w-full text-center truncate px-0.5 ${isLocked ? 'text-[#5a7a65]' : 'text-white'}`}>
          {surname}
        </span>
      ) : (
        <span className="text-[#2d5c3f] text-[9px] leading-none">·</span>
      )}

      {/* Score (when playing) or price paid (pre-round) */}
      {isWater ? (
        <span className="text-[11px] leading-none">🌊</span>
      ) : hasScore ? (
        <span
          className={`text-[12px] font-score leading-none w-6 h-6 flex items-center justify-center ${getScoreClass(scoreVsPar)}`}
        >
          {getScoreLabel(scoreVsPar)}
        </span>
      ) : pricePaid != null ? (
        <span className="text-[#c9a227] text-[9px] font-score leading-none">
          £{pricePaid}m
        </span>
      ) : (
        <span className="text-[#2d5c3f] text-[9px] leading-none">—</span>
      )}
    </button>
  )
}
