'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useEffect } from 'react'
import type { BeatTheBookie } from '@/lib/supabase/types'
import { getPerformanceColour } from '@/lib/pricing/engine'
import DramaFeed from './DramaFeed'
import type { DramaItem } from './DramaFeed'

interface Props {
  tournamentId: string
  round: number
  displayName: string
  leagueId: string | null
}

function PerformanceIcon({ index }: { index: number }) {
  if (index > 100) return <span>🚀</span>
  if (index > 0) return <span>📈</span>
  return <span>📉</span>
}

export default function BeatTheBookieTab({ tournamentId, round, leagueId }: Props) {
  const [tab, setTab] = useState<'drama' | 'bookie'>('drama')
  const [bookieData, setBookieData] = useState<BeatTheBookie[]>([])
  const [dramaItems] = useState<DramaItem[]>([])
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  useEffect(() => {
    if (tab !== 'bookie') return

    const supabase = createClient()

    async function fetchBookie() {
      const { data } = await supabase
        .from('beat_the_bookie')
        .select('*, players(name)')
        .eq('tournament_id', tournamentId)
        .eq('round', round)
        .order('performance_index', { ascending: false })

      if (data) {
        setBookieData(data as BeatTheBookie[])
        if (data[0]?.updated_at) setLastUpdated(data[0].updated_at)
      }
    }

    fetchBookie()

    // Realtime subscription
    const channel = supabase
      .channel('beat-the-bookie')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'beat_the_bookie' },
        () => fetchBookie()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tab, tournamentId, round])

  const outperforming = bookieData.filter((p) => (p.performance_index ?? 0) > 0)
  const underperforming = bookieData.filter((p) => (p.performance_index ?? 0) <= 0)

  return (
    <div className="flex flex-col">
      {/* Tab bar */}
      <div className="flex border-b border-[#1a3d2b]">
        {(['drama', 'bookie'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-semibold transition-colors
              ${tab === t
                ? 'text-[#c9a227] border-b-2 border-[#c9a227]'
                : 'text-[#5a7a65]'}`}
          >
            {t === 'drama' ? '⚡ Drama Feed' : '📈 Beat the Bookie'}
          </button>
        ))}
      </div>

      {tab === 'drama' && <DramaFeed items={dramaItems} />}

      {tab === 'bookie' && (
        <div className="flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-[#1a3d2b]">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Round {round} · Live</h2>
              {lastUpdated && (
                <span className="text-[10px] text-[#5a7a65]">
                  Updated {new Date(lastUpdated).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </div>

          {bookieData.length === 0 ? (
            <div className="px-4 py-8 text-center text-[#5a7a65] text-sm">
              Beat the Bookie data loads when the round begins
            </div>
          ) : (
            <>
              {/* Outperforming */}
              {outperforming.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-[#1a3d2b]">
                    <span className="text-[11px] font-bold text-[#8ab89a] uppercase tracking-wide">
                      Outperforming Odds
                    </span>
                  </div>
                  {outperforming.map((player) => (
                    <BookieRow key={player.id} player={player} />
                  ))}
                </div>
              )}

              {/* Underperforming */}
              {underperforming.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-[#1a3d2b]">
                    <span className="text-[11px] font-bold text-[#8ab89a] uppercase tracking-wide">
                      Underperforming Odds
                    </span>
                  </div>
                  {underperforming.map((player) => (
                    <BookieRow key={player.id} player={player} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Disclaimer */}
          <p className="px-4 py-3 text-[10px] text-[#5a7a65] text-center border-t border-[#1a3d2b]">
            Beat the Bookie is for entertainment and game strategy only. It shows how players are
            performing relative to pre-tournament predictions. Fantasy Flagstick does not offer
            betting services and does not earn commission from any gambling activity.
          </p>
        </div>
      )}
    </div>
  )
}

function BookieRow({ player }: { player: BeatTheBookie & { players?: { name: string } } }) {
  const index = player.performance_index ?? 0
  const colour = getPerformanceColour(index)
  const sign = index >= 0 ? '+' : ''

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1a3d2b]">
      <PerformanceIcon index={index} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">
          {(player as { players?: { name: string } }).players?.name ?? 'Unknown'}
        </p>
        <p className="text-[11px] text-[#8ab89a]">
          Was {player.pre_round_odds_display} → {player.current_odds_display}
        </p>
      </div>
      <div className="text-right">
        <div className="font-score text-sm font-bold" style={{ color: colour }}>
          {sign}{Math.round(index)}%
        </div>
      </div>
    </div>
  )
}
