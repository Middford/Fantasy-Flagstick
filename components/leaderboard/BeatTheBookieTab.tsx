'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useEffect } from 'react'
import type { BeatTheBookie, Hole } from '@/lib/supabase/types'
import { getPerformanceColour } from '@/lib/pricing/engine'


interface Props {
  tournamentId: string
  round: number
  displayName: string
  leagueId: string | null
  userId: string
  holes?: Hole[]
}

interface MastersEntry {
  position: string
  name: string
  total: string
  thru: string
  status: 'active' | 'cut' | 'wd' | 'dq'
}

interface DgLivePlayer {
  dg_id: string
  player_name: string  // already converted to "Firstname Surname"
  sg_total: number | null
}

interface FantasyEntry {
  userId: string
  displayName: string
  totalScore: number
  holesCompleted: number
  position: number
}

interface OddsPlayer {
  name: string
  bestOdds: string
  bestOddsDecimal: number
  bestBook: string
  books: { name: string; fractional: string; decimal: number }[]
}

function PerformanceIcon({ index }: { index: number }) {
  if (index > 100) return <span>🚀</span>
  if (index > 0) return <span>📈</span>
  return <span>📉</span>
}

export default function BeatTheBookieTab({ tournamentId, round, leagueId, userId, holes }: Props) {
  const [tab, setTab] = useState<'leaderboard' | 'bookie' | 'course'>('leaderboard')
  const [bookieData, setBookieData] = useState<BeatTheBookie[]>([])

  const [odds, setOdds] = useState<OddsPlayer[]>([])
  const [oddsLoading, setOddsLoading] = useState(false)
  const [oddsUpdatedAt, setOddsUpdatedAt] = useState<string | null>(null)
  const [mastersEntries, setMastersEntries] = useState<MastersEntry[]>([])
  const [mastersLoading, setMastersLoading] = useState(false)
  const [mastersStatus, setMastersStatus] = useState<string>('pre')
  const [fantasyEntries, setFantasyEntries] = useState<FantasyEntry[]>([])
  const [fantasyLoading, setFantasyLoading] = useState(false)
  const [dgLivePlayers, setDgLivePlayers] = useState<DgLivePlayer[]>([])

  useEffect(() => {
    if (tab !== 'leaderboard') return

    async function fetchMasters() {
      setMastersLoading(true)
      try {
        const res = await fetch('/api/masters-leaderboard')
        if (res.ok) {
          const json = await res.json()
          setMastersEntries(json.entries ?? [])
          setMastersStatus(json.status ?? 'pre')
        }
      } finally {
        setMastersLoading(false)
      }
    }

    async function fetchFantasy() {
      if (!leagueId) return
      setFantasyLoading(true)
      try {
        const res = await fetch(`/api/leaderboard?leagueId=${leagueId}&round=${round}`)
        if (res.ok) {
          const json = await res.json()
          setFantasyEntries(json.entries ?? [])
        }
      } finally {
        setFantasyLoading(false)
      }
    }

    async function fetchDgLiveStats() {
      try {
        const res = await fetch('/api/datagolf/live-stats')
        if (!res.ok) return
        const json = await res.json()
        setDgLivePlayers(json.players ?? [])
      } catch { /* silent failure */ }
    }

    fetchMasters()
    fetchFantasy()
    fetchDgLiveStats()

    const interval = setInterval(() => {
      fetchMasters()
      fetchFantasy()
      fetchDgLiveStats()
    }, 30_000)
    return () => clearInterval(interval)
  }, [tab, leagueId, round]) // eslint-disable-line react-hooks/exhaustive-deps

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
        void data[0]?.updated_at // used for display elsewhere if needed
      }
    }

    async function fetchOdds() {
      setOddsLoading(true)
      try {
        const res = await fetch('/api/odds')
        if (res.ok) {
          const json = await res.json()
          setOdds(json.players ?? [])
          setOddsUpdatedAt(json.updatedAt ?? null)
        }
      } finally {
        setOddsLoading(false)
      }
    }

    fetchBookie()
    fetchOdds()

    // Realtime subscription
    const supabase2 = createClient()
    const channel = supabase2
      .channel('beat-the-bookie')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'beat_the_bookie' },
        () => fetchBookie()
      )
      .subscribe()

    return () => { supabase2.removeChannel(channel) }
  }, [tab, tournamentId, round])

  const outperforming = bookieData.filter((p) => (p.performance_index ?? 0) > 0)
  const underperforming = bookieData.filter((p) => (p.performance_index ?? 0) <= 0)

  return (
    <div className="flex flex-col">
      {/* Tab bar */}
      <div className="flex border-b border-[#1a3d2b]">
        {(['leaderboard', 'bookie', 'course'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-xs font-semibold transition-colors
              ${tab === t
                ? 'text-[#c9a227] border-b-2 border-[#c9a227]'
                : 'text-[#5a7a65]'}`}
          >
            {t === 'leaderboard' ? '🏆 Leaderboard' : t === 'bookie' ? '📈 Bookie' : '🗺 Course'}
          </button>
        ))}
      </div>

      {tab === 'leaderboard' && (
        <div className="flex flex-col pb-24">
          {/* Masters real leaderboard */}
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#8ab89a] uppercase tracking-wide">⛳ The Masters</h2>
            {mastersStatus === 'pre' && (
              <span className="text-[10px] text-[#5a7a65]">Starts Thu 10 Apr</span>
            )}
          </div>
          {mastersLoading && mastersEntries.length === 0 ? (
            <div className="px-4 py-4 text-center text-[#5a7a65] text-sm">Loading…</div>
          ) : mastersEntries.length === 0 ? (
            <div className="px-4 py-4 text-center text-[#5a7a65] text-sm">Leaderboard available once play begins</div>
          ) : (
            <div className="border-b border-[#1a3d2b]">
              {/* Header row */}
              <div className="flex items-center gap-2 px-4 py-1.5 bg-[#0f2518]">
                <span className="w-8 text-[10px] text-[#5a7a65]">Pos</span>
                <span className="flex-1 text-[10px] text-[#5a7a65]">Player</span>
                <span className="w-10 text-right text-[10px] text-[#5a7a65]">Total</span>
                <span className="w-8 text-right text-[10px] text-[#5a7a65]">Thru</span>
                {mastersStatus !== 'pre' && dgLivePlayers.length > 0 && (
                  <span className="w-10 text-right text-[10px] text-[#5a7a65]">SG</span>
                )}
              </div>
              {mastersEntries.slice(0, 30).map((entry, i) => {
                // Match by name — DG player_name already converted to "Firstname Surname"
                const dgPlayer = mastersStatus !== 'pre' ? dgLivePlayers.find(
                  (p) => p.player_name.toLowerCase() === entry.name.toLowerCase()
                ) : undefined
                const sgTotal = dgPlayer?.sg_total ?? null

                return (
                  <div
                    key={i}
                    className={`flex items-center gap-2 px-4 py-2.5 border-b border-[#1a3d2b]
                      ${entry.status !== 'active' ? 'opacity-50' : ''}`}
                  >
                    <span className="w-8 text-[11px] text-[#8ab89a] flex-shrink-0">{entry.position}</span>
                    <span className="flex-1 text-sm text-white font-medium truncate">{entry.name}</span>
                    <span className={`w-10 text-right font-score text-sm font-bold flex-shrink-0
                      ${entry.status !== 'active' ? 'text-[#5a7a65]'
                      : entry.total.startsWith('-') ? 'text-[#4adb7a]'
                      : entry.total === 'E' ? 'text-white'
                      : 'text-[#e05555]'}`}>
                      {entry.total}
                    </span>
                    <span className="w-8 text-right text-[11px] text-[#5a7a65] flex-shrink-0">{entry.thru}</span>
                    {mastersStatus !== 'pre' && dgLivePlayers.length > 0 && (
                      <span className={`w-10 text-right text-[11px] font-score font-bold flex-shrink-0
                        ${sgTotal === null ? 'text-[#5a7a65]'
                        : sgTotal > 0 ? 'text-[#4adb7a]'
                        : sgTotal < 0 ? 'text-[#e05555]'
                        : 'text-[#8ab89a]'}`}>
                        {sgTotal === null ? '—' : `${sgTotal > 0 ? '+' : ''}${sgTotal.toFixed(1)}`}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Fantasy leaderboard */}
          <div className="px-4 pt-4 pb-2">
            <h2 className="text-xs font-bold text-[#8ab89a] uppercase tracking-wide">🃏 Your League · Round {round}</h2>
          </div>
          {!leagueId ? (
            <div className="px-4 py-4 text-center text-[#5a7a65] text-sm">Join a league to see standings</div>
          ) : fantasyLoading && fantasyEntries.length === 0 ? (
            <div className="px-4 py-4 text-center text-[#5a7a65] text-sm">Loading…</div>
          ) : fantasyEntries.length === 0 ? (
            <div className="px-4 py-4 text-center text-[#5a7a65] text-sm">Leaderboard updates as holes complete</div>
          ) : (
            <div className="divide-y divide-[#1a3d2b]">
              {fantasyEntries.map((entry) => (
                <div
                  key={entry.userId}
                  className={`flex items-center gap-3 px-4 py-3
                    ${entry.userId === userId ? 'border-l-2 border-[#c9a227] bg-[#0f2518]' : ''}`}
                >
                  <span className="font-score text-sm text-[#8ab89a] w-5 text-center flex-shrink-0">
                    {entry.position}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {entry.displayName}
                      {entry.userId === userId && (
                        <span className="ml-1.5 text-[10px] text-[#c9a227]">You</span>
                      )}
                    </p>
                    <p className="text-[10px] text-[#5a7a65]">{entry.holesCompleted} holes</p>
                  </div>
                  <span className={`font-score text-base font-bold flex-shrink-0
                    ${entry.totalScore < 0 ? 'text-[#4adb7a]'
                    : entry.totalScore > 0 ? 'text-[#e05555]'
                    : 'text-[#8ab89a]'}`}>
                    {entry.totalScore === 0 ? 'E' : entry.totalScore > 0 ? `+${entry.totalScore}` : `${entry.totalScore}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'course' && <CourseTab holes={holes ?? []} />}

      {tab === 'bookie' && (
        <div className="flex flex-col pb-24">
          {/* Live odds section */}
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#8ab89a] uppercase tracking-wide">🎰 Live Outright Odds</h2>
            {oddsUpdatedAt && (
              <span className="text-[10px] text-[#5a7a65]">
                {new Date(oddsUpdatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          {oddsLoading ? (
            <div className="px-4 py-6 text-center text-[#5a7a65] text-sm">Loading odds…</div>
          ) : odds.length === 0 ? (
            <div className="px-4 py-6 text-center text-[#5a7a65] text-sm">
              Odds unavailable — check back once the tournament begins
            </div>
          ) : (
            <div className="border-b border-[#1a3d2b]">
              {odds.map((player, i) => (
                <OddsRow key={player.name} player={player} rank={i + 1} />
              ))}
            </div>
          )}

          {/* Performance vs odds section */}
          {bookieData.length > 0 && (
            <>
              <div className="px-4 pt-4 pb-2">
                <h2 className="text-xs font-bold text-[#8ab89a] uppercase tracking-wide">📊 Round {round} Performance vs Odds</h2>
              </div>

              {outperforming.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-[#1a3d2b]">
                    <span className="text-[11px] font-bold text-[#8ab89a] uppercase tracking-wide">Outperforming</span>
                  </div>
                  {outperforming.map((player) => (
                    <BookieRow key={player.id} player={player} />
                  ))}
                </div>
              )}

              {underperforming.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-[#1a3d2b]">
                    <span className="text-[11px] font-bold text-[#8ab89a] uppercase tracking-wide">Underperforming</span>
                  </div>
                  {underperforming.map((player) => (
                    <BookieRow key={player.id} player={player} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Disclaimer */}
          <p className="px-4 py-3 text-[10px] text-[#5a7a65] text-center border-t border-[#1a3d2b] mt-2">
            Odds shown for entertainment and game strategy only. Fantasy Flagstick does not offer
            betting services or earn commission from any gambling activity.
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

function OddsRow({ player, rank }: { player: OddsPlayer; rank: number }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="border-b border-[#1a3d2b]">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="w-5 text-[10px] text-[#5a7a65] shrink-0">{rank}</span>
        <span className="flex-1 text-sm text-white font-medium truncate">{player.name}</span>
        <span className="font-score font-bold text-[#c9a227] text-sm">{player.bestOdds}</span>
        <span className="text-[10px] text-[#5a7a65] ml-1 w-16 text-right truncate">{player.bestBook}</span>
        <span className="text-[#5a7a65] text-xs ml-1">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="px-4 pb-3 grid grid-cols-2 gap-1.5">
          {player.books.map((b) => (
            <div key={b.name} className="flex items-center justify-between bg-[#0f2518] rounded-lg px-2.5 py-1.5">
              <span className="text-[10px] text-[#5a7a65]">{b.name}</span>
              <span className="text-[11px] font-score font-bold text-[#c9a227]">{b.fractional}</span>
            </div>
          ))}
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
