'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useEffect } from 'react'
import type { BeatTheBookie, Hole } from '@/lib/supabase/types'
import { getPerformanceColour } from '@/lib/pricing/engine'
import DramaFeed from './DramaFeed'
import type { DramaItem } from './DramaFeed'

interface Props {
  tournamentId: string
  round: number
  displayName: string
  leagueId: string | null
  holes?: Hole[]
}

function PerformanceIcon({ index }: { index: number }) {
  if (index > 100) return <span>🚀</span>
  if (index > 0) return <span>📈</span>
  return <span>📉</span>
}

export default function BeatTheBookieTab({ tournamentId, round, leagueId, holes }: Props) {
  const [tab, setTab] = useState<'drama' | 'bookie' | 'course'>('course')
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
        {(['drama', 'bookie', 'course'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-xs font-semibold transition-colors
              ${tab === t
                ? 'text-[#c9a227] border-b-2 border-[#c9a227]'
                : 'text-[#5a7a65]'}`}
          >
            {t === 'drama' ? '⚡ Drama' : t === 'bookie' ? '📈 Bookie' : '🗺 Course'}
          </button>
        ))}
      </div>

      {tab === 'drama' && <DramaFeed items={dramaItems} />}

      {tab === 'course' && <CourseTab holes={holes ?? []} />}

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

// Augusta National hole descriptions + Amen Corner flags
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
  11: 'Amen Corner begins. A pond guards the entire left side. Miss right at all costs.',
  12: 'The most famous short hole in golf. Wind swirls unpredictably over Rae\'s Creek.',
  13: 'Amen Corner\'s par 5 climax. Eagles possible; the creek collects anything short-left.',
  14: 'The only hole at Augusta without a bunker. Subtle undulations make every approach hard.',
  15: 'The pond in front of the green makes this par 5 the tournament\'s hinge point.',
  16: 'All carry across the pond. Players have made aces and doubles in the same Masters.',
  17: 'A par 4 where placement off the tee defines your angle. The back bunker is a graveyard.',
  18: 'The closing climb past the famous oak tree. Bunkers left demand a controlled draw.',
}

const AMEN_CORNER = new Set([11, 12, 13])

function CourseTab({ holes }: { holes: Hole[] }) {
  const sorted = [...holes].sort((a, b) => a.number - b.number)
  const [selected, setSelected] = useState(1)
  const hole = sorted.find((h) => h.number === selected) ?? sorted[0]

  if (!hole) {
    return (
      <div className="px-4 py-8 text-center text-[#5a7a65] text-sm">
        Course data loads before the tournament begins
      </div>
    )
  }

  const parLabel = hole.par === 3 ? 'Par 3' : hole.par === 5 ? 'Par 5' : 'Par 4'
  const parBg = hole.par === 3 ? 'bg-[#1a2d4d] border-[#2a4a7a]' : hole.par === 5 ? 'bg-[#1a3d2b] border-[#2a6a3a]' : 'bg-[#2d2810] border-[#5c4f1a]'
  const parText = hole.par === 3 ? 'text-[#4a90d9]' : hole.par === 5 ? 'text-[#4adb7a]' : 'text-[#c9a227]'
  const isAmen = AMEN_CORNER.has(hole.number)

  // Difficulty bar: rank 1 = hardest, 18 = easiest
  const diffPct = hole.difficulty_rank != null ? Math.round(((18 - hole.difficulty_rank) / 17) * 100) : null

  return (
    <div className="flex flex-col">
      {/* Hole selector — 2 rows of 9, no scrolling */}
      <div className="grid grid-cols-9 gap-1 px-2 py-2 border-b border-[#1a3d2b]">
        {sorted.map((h) => (
          <button
            key={h.number}
            onClick={() => setSelected(h.number)}
            className={`flex flex-col items-center gap-0 py-1 rounded-lg transition-all
              ${selected === h.number
                ? 'bg-[#c9a227]'
                : AMEN_CORNER.has(h.number)
                ? 'bg-[#3d1a00] border border-[#7a3d00]'
                : 'bg-[#1a3d2b]'}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/holes/hole-${h.number}-icon.svg`}
              alt={`Hole ${h.number}`}
              className={`w-6 h-6 ${selected === h.number ? 'brightness-0' : ''}`}
            />
            <span className={`text-[8px] font-bold leading-tight
              ${selected === h.number ? 'text-[#0a1a10]' : AMEN_CORNER.has(h.number) ? 'text-[#e8a020]' : 'text-[#8ab89a]'}`}>
              {h.number}
            </span>
          </button>
        ))}
      </div>

      {/* Hole detail card */}
      <div className="px-4 py-4">
        {/* Hole image */}
        <div className="rounded-2xl overflow-hidden bg-[#0a1a10] border border-[#1a3d2b] mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/holes/hole-${hole.number}.jpg`}
            alt={`Hole ${hole.number} — ${hole.name}`}
            className="w-full object-contain max-h-48"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
          {/* Header overlay */}
          <div className={`px-4 py-3 border-t border-[#1a3d2b] ${parBg}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-black/30 border border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/holes/hole-${hole.number}-icon.svg`} alt="" className="w-8 h-8" />
                  <span className="text-[8px] text-[#5a7a65] leading-none mt-0.5">{hole.number}</span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#c9a227] leading-tight">{hole.name || `Hole ${hole.number}`}</h2>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${parBg} ${parText}`}>{parLabel}</span>
                    <span className="text-[10px] text-[#8ab89a] px-1.5 py-0.5 rounded-full bg-black/30">{hole.yards} yds</span>
                    {hole.water_hazard && <span className="text-[10px] text-[#4a90d9]">🌊</span>}
                    {isAmen && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#3d1a00] border border-[#7a3d00] text-[#e8a020]">Amen Corner</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-[#1a3d2b] rounded-xl p-3 text-center">
            <div className="text-lg font-score font-bold text-[#4adb7a]">
              {hole.birdie_pct != null ? `${hole.birdie_pct}%` : '—'}
            </div>
            <div className="text-[9px] text-[#5a7a65] uppercase tracking-wide mt-0.5">Birdie rate</div>
          </div>
          <div className="bg-[#1a3d2b] rounded-xl p-3 text-center">
            <div className="text-lg font-score font-bold text-[#e05555]">
              {hole.bogey_pct != null ? `${hole.bogey_pct}%` : '—'}
            </div>
            <div className="text-[9px] text-[#5a7a65] uppercase tracking-wide mt-0.5">Bogey rate</div>
          </div>
          <div className="bg-[#1a3d2b] rounded-xl p-3 text-center">
            <div className="text-lg font-score font-bold text-[#c9a227]">
              {hole.eagle_pct != null && hole.eagle_pct > 0 ? `${hole.eagle_pct}%` : '—'}
            </div>
            <div className="text-[9px] text-[#5a7a65] uppercase tracking-wide mt-0.5">Eagle rate</div>
          </div>
        </div>

        {/* Difficulty bar */}
        {diffPct != null && (
          <div className="mb-4">
            <div className="flex justify-between text-[10px] text-[#5a7a65] mb-1">
              <span>Difficulty</span>
              <span>{hole.difficulty_rank != null ? `#${hole.difficulty_rank} hardest` : ''}</span>
            </div>
            <div className="h-2 rounded-full bg-[#1a3d2b] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#4adb7a] to-[#e05555] transition-all"
                style={{ width: `${diffPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Avg score */}
        {hole.avg_score != null && (
          <div className="flex justify-between text-sm mb-4 px-1">
            <span className="text-[#5a7a65]">Scoring average</span>
            <span className="font-score font-bold text-white">{hole.avg_score.toFixed(2)}</span>
          </div>
        )}

        {/* Description */}
        <div className="bg-[#0f2518] rounded-xl p-3.5 border border-[#1a3d2b]">
          <p className="text-sm text-[#8ab89a] leading-relaxed">
            {HOLE_NOTES[hole.number] ?? 'Augusta National — home of the Masters Tournament.'}
          </p>
        </div>

        {/* Prev / Next nav */}
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => setSelected((s) => Math.max(1, s - 1))}
            disabled={selected <= 1}
            className="flex-1 py-2.5 rounded-xl border border-[#2d5c3f] text-sm font-bold text-[#8ab89a] disabled:opacity-30"
          >
            ← Prev
          </button>
          <button
            onClick={() => setSelected((s) => Math.min(18, s + 1))}
            disabled={selected >= 18}
            className="flex-1 py-2.5 rounded-xl border border-[#2d5c3f] text-sm font-bold text-[#8ab89a] disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}

function RulesTab() {
  return (
    <div className="flex flex-col divide-y divide-[#1a3d2b] pb-6">
      {/* Objective */}
      <div className="px-4 py-4">
        <h3 className="text-xs font-bold text-[#c9a227] uppercase tracking-wide mb-2">🎯 Objective</h3>
        <p className="text-sm text-[#8ab89a] leading-relaxed">
          Pick one golfer per hole, per round. Your score is the sum of your players&apos; scores on each hole.
          Lowest score wins — just like real golf.
        </p>
      </div>

      {/* Budget */}
      <div className="px-4 py-4">
        <h3 className="text-xs font-bold text-[#c9a227] uppercase tracking-wide mb-2">💷 Budget</h3>
        <p className="text-sm text-[#8ab89a] leading-relaxed mb-2">
          You have <span className="text-white font-bold">£180m</span> to spend per round across 18 holes.
          Player prices range from <span className="text-white font-bold">£4m</span> (rank outsider) to <span className="text-white font-bold">£15m</span> (world #1).
        </p>
        <p className="text-sm text-[#8ab89a] leading-relaxed">
          You can pick the same player a maximum of <span className="text-white font-bold">3 times</span> per round.
          Prices shift between rounds based on form.
        </p>
      </div>

      {/* Scoring */}
      <div className="px-4 py-4">
        <h3 className="text-xs font-bold text-[#c9a227] uppercase tracking-wide mb-2">⛳ Scoring</h3>
        <div className="space-y-1.5 text-sm">
          {[
            { label: 'Eagle', score: '−2', colour: 'text-[#4adb7a]', note: 'or better' },
            { label: 'Birdie', score: '−1', colour: 'text-[#4adb7a]', note: '' },
            { label: 'Par', score: 'E', colour: 'text-white', note: '' },
            { label: 'Bogey', score: '+1', colour: 'text-[#e05555]', note: '' },
            { label: 'Double+', score: '+2', colour: 'text-[#e05555]', note: 'or worse' },
          ].map(({ label, score, colour, note }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-[#8ab89a]">{label}{note ? ` (${note})` : ''}</span>
              <span className={`font-score font-bold ${colour}`}>{score}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-[#5a7a65] mt-2 leading-snug">
          Holes where your player hasn&apos;t yet played don&apos;t count toward your score until confirmed.
        </p>
      </div>

      {/* Chips */}
      <div className="px-4 py-4">
        <h3 className="text-xs font-bold text-[#c9a227] uppercase tracking-wide mb-3">🃏 Chips</h3>
        <p className="text-[11px] text-[#5a7a65] mb-3">
          Each chip can only be used once per tournament and cannot be undone.
        </p>
        <div className="space-y-3">
          <div className="bg-[#1a3d2b] rounded-xl p-3 flex items-start gap-3">
            <span className="text-2xl">🏆</span>
            <div>
              <p className="text-sm font-bold text-[#c9a227]">Sponsorship Deal</p>
              <p className="text-[11px] text-[#8ab89a] leading-snug mt-0.5">
                Boosts your round budget by <strong className="text-white">£20m</strong>. Activate before making picks to afford a premium player you&apos;d otherwise miss.
              </p>
            </div>
          </div>
          <div className="bg-[#1a3d2b] rounded-xl p-3 flex items-start gap-3">
            <span className="text-2xl">📮</span>
            <div>
              <p className="text-sm font-bold text-[#d63030]">Postman</p>
              <p className="text-[11px] text-[#8ab89a] leading-snug mt-0.5">
                Choose one player whose score is <strong className="text-white">doubled</strong> on every hole you pick them this round. High risk, high reward — eagles become −4, but bogeys become +2.
              </p>
            </div>
          </div>
          <div className="bg-[#1a3d2b] rounded-xl p-3 flex items-start gap-3">
            <span className="text-2xl">🔄</span>
            <div>
              <p className="text-sm font-bold text-[#20a090]">Mulligan</p>
              <p className="text-[11px] text-[#8ab89a] leading-snug mt-0.5">
                Swap one locked pick for a different player who hasn&apos;t yet completed that hole. Save it for a disaster — use it when your pick makes a triple.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Locking */}
      <div className="px-4 py-4">
        <h3 className="text-xs font-bold text-[#c9a227] uppercase tracking-wide mb-2">🔒 Locking</h3>
        <p className="text-sm text-[#8ab89a] leading-relaxed">
          Picks lock once your chosen player completes a hole. You can swap a pick freely before they tee off. Once locked, only a Mulligan chip can change it.
        </p>
      </div>

      {/* Winning */}
      <div className="px-4 py-4">
        <h3 className="text-xs font-bold text-[#c9a227] uppercase tracking-wide mb-2">🥇 Winning</h3>
        <p className="text-sm text-[#8ab89a] leading-relaxed">
          The player with the <span className="text-white font-bold">lowest combined score</span> across all four rounds wins the league. Tiebreaker: most holes completed.
        </p>
      </div>
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
