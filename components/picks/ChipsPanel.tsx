'use client'

import type { Chips, Player } from '@/lib/supabase/types'

interface ChipsPanelProps {
  chips: Chips | null
  round: number
  players: Player[]
  onUseSponsorshipDeal: () => void
  onSelectPostman: (playerId: string) => void
  onUseMulligan: () => void
}

export default function ChipsPanel({
  chips,
  round,
  onUseSponsorshipDeal,
  onSelectPostman,
  onUseMulligan,
}: ChipsPanelProps) {
  if (!chips) return null

  const postmanKey = `postman_r${round}_player_id` as keyof Chips
  const postmanUsed = !!chips[postmanKey]
  const sponsorshipUsed = chips.sponsorship_used
  const mulliganUsed = chips.mulligan_used

  return (
    <div className="flex gap-2 px-4 py-3 border-b border-[#1a3d2b] overflow-x-auto">
      {/* Sponsorship Deal */}
      <button
        onClick={!sponsorshipUsed ? onUseSponsorshipDeal : undefined}
        disabled={sponsorshipUsed}
        className={`flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl border transition-all
          ${sponsorshipUsed
            ? 'border-[#2d5c3f] bg-[#0a1a10] opacity-50 cursor-not-allowed'
            : 'border-[#2a7a3a] bg-[#1a3d2b] active:scale-95'}`}
      >
        <span className="text-xl">🏆</span>
        <span className="text-[10px] font-bold text-[#c9a227] whitespace-nowrap">Sponsor</span>
        <span className="text-[9px] text-[#8ab89a] whitespace-nowrap">+£36m</span>
        {sponsorshipUsed && <span className="text-[9px] text-[#5a7a65]">Used R{chips.sponsorship_round}</span>}
      </button>

      {/* Postman */}
      <button
        onClick={!postmanUsed ? () => onSelectPostman('') : undefined}
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
        onClick={!mulliganUsed ? onUseMulligan : undefined}
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
  )
}
