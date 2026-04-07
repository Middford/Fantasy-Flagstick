'use client'

import { useState } from 'react'
import type { Chips, Player } from '@/lib/supabase/types'

interface ChipsPanelProps {
  chips: Chips | null
  round: number
  players: Player[]
  onUseSponsorshipDeal: () => void
  onSelectPostman: (playerId: string) => void
  onUseMulligan: () => void
}

interface PendingChip {
  type: 'sponsorship' | 'postman' | 'mulligan'
  label: string
  emoji: string
  description: string
}

export default function ChipsPanel({
  chips,
  round,
  onUseSponsorshipDeal,
  onSelectPostman,
  onUseMulligan,
}: ChipsPanelProps) {
  const [pending, setPending] = useState<PendingChip | null>(null)

  if (!chips) return null

  const postmanKey = `postman_r${round}_player_id` as keyof Chips
  const postmanUsed = !!chips[postmanKey]
  const sponsorshipUsed = chips.sponsorship_used
  const mulliganUsed = chips.mulligan_used

  function confirmChip() {
    if (!pending) return
    if (pending.type === 'sponsorship') onUseSponsorshipDeal()
    if (pending.type === 'postman') onSelectPostman('')
    if (pending.type === 'mulligan') onUseMulligan()
    setPending(null)
  }

  return (
    <>
      <div className="flex gap-2 px-4 py-3 border-b border-[#1a3d2b] overflow-x-auto">
        {/* Sponsorship Deal */}
        <button
          onClick={!sponsorshipUsed ? () => setPending({
            type: 'sponsorship',
            label: 'Sponsorship Deal',
            emoji: '🏆',
            description: 'Adds £20m to your budget for this round. Use it to afford a top player you\'d otherwise miss.',
          }) : undefined}
          disabled={sponsorshipUsed}
          className={`flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl border transition-all
            ${sponsorshipUsed
              ? 'border-[#2d5c3f] bg-[#0a1a10] opacity-50 cursor-not-allowed'
              : 'border-[#2a7a3a] bg-[#1a3d2b] active:scale-95'}`}
        >
          <span className="text-xl">🏆</span>
          <span className="text-[10px] font-bold text-[#c9a227] whitespace-nowrap">Sponsor</span>
          <span className="text-[9px] text-[#8ab89a] whitespace-nowrap">+£20m</span>
          {sponsorshipUsed && <span className="text-[9px] text-[#5a7a65]">Used R{chips.sponsorship_round}</span>}
        </button>

        {/* Postman */}
        <button
          onClick={!postmanUsed ? () => setPending({
            type: 'postman',
            label: 'Postman',
            emoji: '📮',
            description: 'Choose one player whose score is doubled on every hole you pick them this round. Pick wisely — it cuts both ways.',
          }) : undefined}
          disabled={postmanUsed}
          className={`flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl border transition-all
            ${postmanUsed
              ? 'border-[#2d5c3f] bg-[#0a1a10] opacity-50 cursor-not-allowed'
              : 'border-[#d63030] bg-[#1a3d2b] active:scale-95'}`}
        >
          <span className="text-xl">📮</span>
          <span className="text-[10px] font-bold text-[#d63030] whitespace-nowrap">Postman</span>
          <span className="text-[9px] text-[#8ab89a] whitespace-nowrap">2× score</span>
          {postmanUsed && <span className="text-[9px] text-[#5a7a65]">Active R{round}</span>}
        </button>

        {/* Mulligan */}
        <button
          onClick={!mulliganUsed ? () => setPending({
            type: 'mulligan',
            label: 'Mulligan',
            emoji: '🔄',
            description: 'Swap one locked pick for a different player who hasn\'t yet completed that hole.',
          }) : undefined}
          disabled={mulliganUsed}
          className={`flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl border transition-all
            ${mulliganUsed
              ? 'border-[#2d5c3f] bg-[#0a1a10] opacity-50 cursor-not-allowed'
              : 'border-[#20a090] bg-[#1a3d2b] active:scale-95'}`}
        >
          <span className="text-xl">🔄</span>
          <span className="text-[10px] font-bold text-[#20a090] whitespace-nowrap">Mulligan</span>
          <span className="text-[9px] text-[#8ab89a] whitespace-nowrap">Swap pick</span>
          {mulliganUsed && <span className="text-[9px] text-[#5a7a65]">Used H{chips.mulligan_hole}</span>}
        </button>
      </div>

      {/* Confirmation dialog */}
      {pending && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setPending(null)}
          />
          <div className="relative w-full max-w-[390px] bg-[#0a1a10] rounded-t-2xl px-5 pt-5 pb-8 border-t border-[#1a3d2b]">
            {/* Chip icon */}
            <div className="flex justify-center mb-3">
              <span className="text-5xl">{pending.emoji}</span>
            </div>

            <h2 className="text-lg font-bold text-white text-center">{pending.label}</h2>
            <p className="text-sm text-[#8ab89a] text-center mt-2 leading-relaxed">
              {pending.description}
            </p>

            {/* Warning */}
            <div className="mt-4 px-4 py-3 rounded-xl bg-[#3d2200] border border-[#7a4500] flex items-start gap-2.5">
              <span className="text-lg flex-shrink-0">⚠️</span>
              <p className="text-sm text-[#e8a020] leading-snug font-medium">
                This chip cannot be undone once activated. You only get one per tournament.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setPending(null)}
                className="flex-1 py-3 rounded-xl border border-[#2d5c3f] text-sm font-bold text-[#8ab89a]"
              >
                Cancel
              </button>
              <button
                onClick={confirmChip}
                className="flex-1 py-3 rounded-xl bg-[#c9a227] text-sm font-bold text-[#0a1a10] active:scale-95 transition-all"
              >
                Activate
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
