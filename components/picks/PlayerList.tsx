'use client'

import { useRouter } from 'next/navigation'
import type { Player } from '@/lib/supabase/types'
import { ArrowUp, ArrowDown, Minus } from 'lucide-react'

interface TeeTime { r1: string | null; r2: string | null }

interface PlayerListProps {
  players: Player[]
  holeNumber: number
  round: number
  picks: Map<string, number>            // playerId → uses this round
  remainingBudget: number
  currentPickPlayerId: string | null
  currentPickPricePaid: number          // price refunded if hole is swapped (0 if empty)
  postmanPlayerId: string | null
  completedHoleScores: Map<string, boolean>  // playerId → has completed hole N-1
  beatTheBookieMap?: Map<string, { index: number; direction: string }>
  teeTimes?: Record<string, TeeTime>    // player name_full.toLowerCase() → tee times
  onPick: (player: Player) => void
}

function PriceArrow({ direction }: { direction: string }) {
  if (direction === 'up') return <ArrowUp size={12} className="text-[#4adb7a]" />
  if (direction === 'down') return <ArrowDown size={12} className="text-[#e05555]" />
  return <Minus size={12} className="text-[#5a7a65]" />
}

function scoreLabel(scoreVsPar: number): string {
  if (scoreVsPar === 0) return 'E'
  return scoreVsPar > 0 ? `+${scoreVsPar}` : `${scoreVsPar}`
}

export default function PlayerList({
  players,
  holeNumber,
  round,
  picks,
  remainingBudget,
  currentPickPlayerId,
  currentPickPricePaid,
  postmanPlayerId,
  completedHoleScores,
  beatTheBookieMap,
  teeTimes,
  onPick,
}: PlayerListProps) {
  const router = useRouter()
  // Sort: availability groups first, then by tee time ascending, price descending as tiebreak
  const getTeeTime = (p: Player): string => {
    const pt = teeTimes?.[p.name_full.toLowerCase()]
    const t = round === 2 ? (pt?.r2 ?? pt?.r1) : pt?.r1
    return t ?? '99:99'  // No tee time → push to end
  }

  const sorted = [...players].sort((a, b) => {
    const aLocked = completedHoleScores.get(a.id) ?? false
    const bLocked = completedHoleScores.get(b.id) ?? false
    const aMaxUses = (picks.get(a.id) ?? 0) >= 3
    const bMaxUses = (picks.get(b.id) ?? 0) >= 3
    const aCantAfford = a.current_price > remainingBudget
    const bCantAfford = b.current_price > remainingBudget

    // Availability groups
    if (aLocked !== bLocked) return aLocked ? 1 : -1
    if (aMaxUses !== bMaxUses) return aMaxUses ? 1 : -1
    if (aCantAfford !== bCantAfford) return aCantAfford ? 1 : -1

    // Within each group: earliest tee time first (HH:MM compares lexicographically)
    const aTee = getTeeTime(a)
    const bTee = getTeeTime(b)
    if (aTee !== bTee) return aTee.localeCompare(bTee)

    // Tiebreak: higher price first (stars first within same slot)
    return b.current_price - a.current_price
  })

  const activePlayers = sorted.filter((p) => p.status === 'active')

  return (
    <div className="flex flex-col divide-y divide-[#1a3d2b]">
      {activePlayers.map((player) => {
        const uses = picks.get(player.id) ?? 0
        const isPicked = player.id === currentPickPlayerId
        const isPostman = player.id === postmanPlayerId
        const lockedOut = completedHoleScores.get(player.id) ?? false
        const maxUses = uses >= 3
        // Net cost of picking this player on this hole = price minus refund from current pick
        const netCost = player.current_price - currentPickPricePaid
        const cantAfford = netCost > remainingBudget && !isPicked
        const disabled = lockedOut || maxUses || (cantAfford && !isPicked)

        const btb = beatTheBookieMap?.get(player.id)
        const btbIcon = btb && btb.index > 100 ? '🚀' : btb && btb.index > 0 ? '📈' : btb ? '📉' : null

        return (
          <div
            key={player.id}
            onClick={() => router.push(`/player/${player.id}`)}
            className={`flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer active:bg-[#1a3d2b]
              ${isPicked ? 'bg-[#1a3d2b] border-l-2 border-[#c9a227]' : ''}
              ${disabled ? 'opacity-50' : ''}`}
          >
            {/* Name + country */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-white truncate">
                  {player.name}
                </span>
                {isPostman && <span className="text-[10px] bg-[#d63030] rounded px-1 text-white">📮</span>}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-[#8ab89a]">
                <span>{player.country}</span>
                {player.holes_completed > 0 ? (
                  <span>· Thru {player.holes_completed}</span>
                ) : (
                  (() => {
                    const pt = teeTimes?.[player.name_full.toLowerCase()]
                    const raw = round === 2 ? (pt?.r2 ?? pt?.r1) : pt?.r1
                    return raw ? <span>· Tee {raw}</span> : null
                  })()
                )}
                {lockedOut && (
                  <span className="text-[#e8a020]">Locked out</span>
                )}
              </div>
            </div>

            {/* Today's score */}
            <div className="text-center w-10">
              {player.holes_completed > 0 ? (
                <span className="font-score text-sm text-white">
                  {scoreLabel(player.current_round_score)}
                </span>
              ) : (
                <span className="text-[#5a7a65] text-sm">—</span>
              )}
            </div>

            {/* Price */}
            <div className="flex items-center gap-0.5 w-14 justify-end">
              <PriceArrow direction={player.price_direction ?? 'flat'} />
              <span className="font-score text-sm font-bold text-[#c9a227]">£{player.current_price}m</span>
            </div>

            {/* BtB indicator */}
            {btbIcon && (
              <span className="text-sm">{btbIcon}</span>
            )}

            {/* Uses */}
            <div className="text-[10px] text-[#5a7a65] w-6 text-center">
              {uses}/3
            </div>

            {/* Pick button */}
            <button
              onClick={(e) => { e.stopPropagation(); if (!disabled) onPick(player) }}
              disabled={disabled}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                ${isPicked
                  ? 'bg-[#c9a227] text-[#0a1a10]'
                  : isPostman
                  ? 'bg-[#d63030] text-white'
                  : disabled
                  ? 'bg-[#1a3d2b] text-[#5a7a65] cursor-not-allowed'
                  : 'bg-[#2d5c3f] text-white active:scale-95'}`}
            >
              {isPicked ? '✓' : maxUses ? 'Max' : lockedOut ? 'Out' : `£${player.current_price}m`}
            </button>
          </div>
        )
      })}
    </div>
  )
}
