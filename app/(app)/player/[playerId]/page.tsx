import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { HoleScore } from '@/lib/supabase/types'
import { dataGolf } from '@/lib/datagolf/client'

// Augusta pars — fallback if holes table not seeded
const AUGUSTA_PARS: Record<number, number> = {
  1:4, 2:5, 3:4, 4:3, 5:4, 6:3, 7:4, 8:5, 9:4,
  10:4, 11:4, 12:3, 13:5, 14:4, 15:5, 16:3, 17:4, 18:4,
}

interface EspnProfile {
  displayName?: string
  dateOfBirth?: string
  birthPlace?: { city?: string; country?: string }
  college?: string
  displayHeight?: string
  displayWeight?: string
  debutYear?: number
}

async function fetchEspnProfile(espnId: string): Promise<EspnProfile | null> {
  try {
    const res = await fetch(
      `https://sports.core.api.espn.com/v2/sports/golf/leagues/pga/athletes/${espnId}?lang=en&region=gb`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

interface DataGolfStats {
  currentPos: string | null
  winPct: number | null
  makeCutPct: number | null
  today: number | null
  thru: number | null
}

async function fetchDataGolfStats(dgId: string): Promise<DataGolfStats | null> {
  if (!process.env.DATAGOLF_API_KEY) return null
  try {
    const preds = await dataGolf.getInPlayPredictions()
    const entry = preds.data.find((p) => String(p.dg_id) === dgId)
    if (!entry) return null
    return {
      currentPos: entry.current_pos ?? null,
      winPct: entry.win != null ? Math.round(entry.win * 1000) / 10 : null,
      makeCutPct: entry.make_cut != null ? Math.round(entry.make_cut * 1000) / 10 : null,
      today: entry.today ?? null,
      thru: entry.thru ?? null,
    }
  } catch {
    return null
  }
}

function ageFromDob(dob: string): number | null {
  try {
    const birth = new Date(dob)
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
    return age
  } catch { return null }
}

function scoreLabel(s: number): string {
  if (s === 0) return 'E'
  return s > 0 ? `+${s}` : `${s}`
}

function scoreColour(s: number): string {
  if (s < 0) return 'text-[#4adb7a]'
  if (s > 0) return 'text-[#e05555]'
  return 'text-white'
}

const countryFlags: Record<string, string> = {
  USA:'🇺🇸', ENG:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', SCO:'🏴󠁧󠁢󠁳󠁣󠁴󠁿', WAL:'🏴󠁧󠁢󠁷󠁬󠁳󠁿', IRL:'🇮🇪',
  ESP:'🇪🇸', RSA:'🇿🇦', AUS:'🇦🇺', JPN:'🇯🇵', KOR:'🇰🇷',
  NOR:'🇳🇴', SWE:'🇸🇪', CAN:'🇨🇦', ARG:'🇦🇷', COL:'🇨🇴',
  GER:'🇩🇪', FRA:'🇫🇷', BEL:'🇧🇪', CHN:'🇨🇳', NZL:'🇳🇿',
  ZIM:'🇿🇼', FIJ:'🇫🇯', VEN:'🇻🇪', CZE:'🇨🇿', SVK:'🇸🇰',
  ITA:'🇮🇹', DEN:'🇩🇰', AUT:'🇦🇹', THA:'🇹🇭',
}

// Score cell — vertical layout (one column per round)
function ScoreCell({ score, par, isTotal }: { score: number | null; par: number; isTotal?: boolean }) {
  if (score === null) {
    return (
      <td className="text-center py-2 px-1 border-b border-[#1a3d2b] text-[#3d5c40] text-xs">—</td>
    )
  }
  const vspar = isTotal ? score : score - par

  let inner: React.ReactNode
  let bg = ''

  if (vspar <= -2) {
    inner = (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border-2 border-[#4adb7a] text-[#4adb7a] text-[11px] font-bold">
        {score}
      </span>
    )
  } else if (vspar === -1) {
    inner = (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-[#4adb7a] text-[#4adb7a] text-[11px] font-bold">
        {score}
      </span>
    )
  } else if (vspar === 0) {
    inner = <span className="text-white text-[11px] font-bold">{score}</span>
  } else if (vspar === 1) {
    inner = (
      <span className="inline-flex items-center justify-center w-6 h-6 border border-[#e05555] text-[#e05555] text-[11px] font-bold">
        {score}
      </span>
    )
    bg = 'bg-[#1a0a0a]'
  } else {
    inner = (
      <span className="inline-flex items-center justify-center w-6 h-6 bg-[#e05555] text-white text-[11px] font-bold">
        {score}
      </span>
    )
    bg = 'bg-[#1a0a0a]'
  }

  return (
    <td className={`text-center py-2 px-1 border-b border-[#1a3d2b] ${bg}`}>
      {inner}
    </td>
  )
}

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ playerId: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { playerId } = await params
  const db = createServiceClient()

  // Fetch player, hole scores and holes in parallel
  const [
    { data: player },
    { data: holeScores },
    { data: holes },
  ] = await Promise.all([
    db.from('players').select('*').eq('id', playerId).single(),
    db.from('hole_scores').select('*').eq('player_id', playerId).order('round').order('hole_number'),
    db.from('holes').select('number, par').order('number'),
  ])

  if (!player) notFound()

  // Build par lookup — prefer DB, fall back to Augusta constants
  const parMap: Record<number, number> = { ...AUGUSTA_PARS }
  if (holes) {
    holes.forEach((h) => { parMap[h.number] = h.par })
  }

  // Fetch ESPN profile, DataGolf stats, and tournament field in parallel
  const [espnProfile, dgStats, { data: fieldPlayers }] = await Promise.all([
    player.espn_id ? fetchEspnProfile(player.espn_id) : Promise.resolve(null),
    player.datagolf_id ? fetchDataGolfStats(player.datagolf_id) : Promise.resolve(null),
    db.from('players')
      .select('id, total_score, holes_completed, status')
      .eq('tournament_id', player.tournament_id)
      .in('status', ['active', 'cut', 'wd', 'dq'])
      .order('total_score'),
  ])

  // Compute tournament position (DataGolf is authoritative; DB total_score as fallback)
  const startedPlayers = (fieldPlayers ?? []).filter((p) => p.holes_completed > 0)
  const tournamentPos = (() => {
    if (player.holes_completed === 0) return null
    if (dgStats?.currentPos) return dgStats.currentPos
    let pos = 1
    let tie = false
    for (const p of startedPlayers) {
      if (p.id === player.id) break
      if (p.total_score < player.total_score) pos++
      else if (p.total_score === player.total_score) tie = true
    }
    return tie ? `T${pos}` : String(pos)
  })()

  const headshotUrl = player.espn_id
    ? `https://a.espncdn.com/i/headshots/golf/players/full/${player.espn_id}.png`
    : null

  const age = espnProfile?.dateOfBirth ? ageFromDob(espnProfile.dateOfBirth) : null
  const flag = countryFlags[player.country] ?? '🌍'

  const priceChange = player.current_price - player.price_r1
  const priceChangeStr = priceChange === 0 ? null
    : priceChange > 0 ? `+£${priceChange}m` : `-£${Math.abs(priceChange)}m`

  // Group hole scores by round
  const byRound: Record<number, HoleScore[]> = { 1: [], 2: [], 3: [], 4: [] }
  ;(holeScores ?? []).forEach((hs) => {
    if (byRound[hs.round]) byRound[hs.round].push(hs)
  })

  // Round totals
  function roundTotal(round: number): number | null {
    const scores = byRound[round].filter((hs) => hs.confirmed && hs.score !== null)
    if (scores.length === 0) return null
    return scores.reduce((sum, hs) => sum + (hs.score ?? 0), 0)
  }
  function roundVsPar(round: number): number | null {
    const scores = byRound[round].filter((hs) => hs.confirmed && hs.score_vs_par !== null)
    if (scores.length === 0) return null
    return scores.reduce((sum, hs) => sum + (hs.score_vs_par ?? 0), 0)
  }

  const holeNums = Array.from({ length: 18 }, (_, i) => i + 1)
  const augustaPar = holeNums.reduce((s, n) => s + parMap[n], 0)

  return (
    <div className="flex flex-col min-h-screen bg-[#0a1a10]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0a1a10] border-b border-[#1a3d2b] px-4 py-3 flex items-center gap-3">
        <Link href="/picks" className="text-[#8ab89a] active:opacity-60">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-base font-bold text-[#c9a227] truncate">{player.name_full}</h1>
      </header>

      {/* Hero */}
      <div className="flex items-center gap-4 px-4 pt-5 pb-4 border-b border-[#1a3d2b] bg-gradient-to-b from-[#0f2518] to-[#0a1a10]">
        <div className="flex-shrink-0 w-20 h-20 rounded-2xl overflow-hidden bg-[#1a3d2b] border border-[#2d5c3f]">
          {headshotUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={headshotUrl} alt={player.name_full} className="w-full h-full object-cover object-top" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl">🏌️</div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-white leading-tight">{player.name_full}</h2>
          <p className="text-sm text-[#8ab89a]">
            {flag} {player.country}{age ? ` · Age ${age}` : ''}
          </p>
          {player.world_ranking && (
            <p className="text-xs text-[#5a7a65]">World Ranking #{player.world_ranking}</p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm font-bold font-score text-[#c9a227]">£{player.current_price}m</span>
            {priceChangeStr && (
              <span className={`text-xs font-bold ${priceChange > 0 ? 'text-[#4adb7a]' : 'text-[#e05555]'}`}>
                {priceChangeStr} since R1
              </span>
            )}
          </div>
        </div>
        {/* Status badge */}
        {player.status !== 'active' && (
          <div className="flex-shrink-0 px-2 py-1 rounded-lg bg-[#3d1a1a] border border-[#5c2d2d]">
            <span className="text-xs font-bold text-[#e05555]">
              {player.status === 'cut' ? '✂️ Cut' : player.status === 'wd' ? 'WD' : 'DQ'}
            </span>
          </div>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-2 px-4 py-4 border-b border-[#1a3d2b]">
        <div className="bg-[#1a3d2b] rounded-xl p-3 text-center">
          <div className="text-xl font-score font-bold text-white">
            {tournamentPos ?? '—'}
          </div>
          <div className="text-[10px] text-[#8ab89a] uppercase tracking-wide mt-0.5">Pos</div>
        </div>
        <div className="bg-[#1a3d2b] rounded-xl p-3 text-center">
          <div className={`text-xl font-score font-bold ${scoreColour(player.total_score)}`}>
            {scoreLabel(player.total_score)}
          </div>
          <div className="text-[10px] text-[#8ab89a] uppercase tracking-wide mt-0.5">Total</div>
        </div>
        <div className="bg-[#1a3d2b] rounded-xl p-3 text-center">
          <div className={`text-xl font-score font-bold ${scoreColour(player.current_round_score)}`}>
            {player.holes_completed > 0 ? scoreLabel(player.current_round_score) : '—'}
          </div>
          <div className="text-[10px] text-[#8ab89a] uppercase tracking-wide mt-0.5">Today</div>
        </div>
        <div className="bg-[#1a3d2b] rounded-xl p-3 text-center">
          <div className="text-xl font-score font-bold text-white">
            {player.holes_completed > 0 ? player.holes_completed : '—'}
          </div>
          <div className="text-[10px] text-[#8ab89a] uppercase tracking-wide mt-0.5">Thru</div>
        </div>
      </div>

      {/* DataGolf win probabilities */}
      {dgStats && (dgStats.winPct !== null || dgStats.makeCutPct !== null) && (
        <div className="px-4 py-4 border-b border-[#1a3d2b]">
          <h3 className="text-xs font-bold text-[#8ab89a] uppercase tracking-wide mb-3">Win Probability</h3>
          <div className="grid grid-cols-2 gap-3">
            {dgStats.winPct !== null && (
              <div className="bg-[#1a3d2b] rounded-xl p-3 text-center">
                <div className="text-2xl font-score font-bold text-[#c9a227]">{dgStats.winPct}%</div>
                <div className="text-[10px] text-[#8ab89a] uppercase tracking-wide mt-0.5">Win</div>
              </div>
            )}
            {dgStats.makeCutPct !== null && (
              <div className="bg-[#1a3d2b] rounded-xl p-3 text-center">
                <div className="text-2xl font-score font-bold text-[#4adb7a]">{dgStats.makeCutPct}%</div>
                <div className="text-[10px] text-[#8ab89a] uppercase tracking-wide mt-0.5">Make Cut</div>
              </div>
            )}
          </div>
          <p className="text-[9px] text-[#3d5c40] mt-2 text-center">DataGolf live model · updated every 5 min</p>
        </div>
      )}

      {/* Official Scorecard — vertical (one row per hole) */}
      <div className="border-b border-[#1a3d2b]">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <h3 className="text-xs font-bold text-[#8ab89a] uppercase tracking-wide">Official Score Card</h3>
          {/* Legend */}
          <div className="flex gap-2 text-[9px] text-[#5a7a65]">
            <span className="flex items-center gap-0.5"><span className="inline-flex w-3 h-3 rounded-full border-2 border-[#4adb7a]" />Eagle</span>
            <span className="flex items-center gap-0.5"><span className="inline-flex w-3 h-3 rounded-full border border-[#4adb7a]" />Birdie</span>
            <span className="flex items-center gap-0.5"><span className="inline-flex w-3 h-3 border border-[#e05555]" />Bogey</span>
            <span className="flex items-center gap-0.5"><span className="inline-flex w-3 h-3 bg-[#e05555]" />D+</span>
          </div>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#1a4d2e]">
              <th className="text-left pl-4 pr-2 py-2 text-white font-bold text-xs w-14">Hole</th>
              <th className="text-center px-2 py-2 text-[#c9a227] font-bold text-xs w-10">Par</th>
              <th className="text-center px-2 py-2 text-white font-bold text-xs">R1</th>
              <th className="text-center px-2 py-2 text-white font-bold text-xs">R2</th>
              <th className="text-center px-2 py-2 text-white font-bold text-xs">R3</th>
              <th className="text-center px-2 py-2 text-white font-bold text-xs">R4</th>
            </tr>
          </thead>
          <tbody>
            {holeNums.map((n) => {
              const par = parMap[n]
              const isAmen = n === 11 || n === 12 || n === 13
              return (
                <tr key={n} className={isAmen ? 'bg-[#0f1f0a]' : 'bg-[#0a1a10]'}>
                  <td className="pl-4 pr-2 py-2 border-b border-[#1a3d2b]">
                    <span className={`text-xs font-bold ${isAmen ? 'text-[#e8a020]' : 'text-[#8ab89a]'}`}>{n}</span>
                  </td>
                  <td className="text-center px-2 py-2 border-b border-[#1a3d2b] text-xs text-[#c9a227] font-bold">{par}</td>
                  {([1, 2, 3, 4] as const).map((round) => {
                    const hs = byRound[round].find((s) => s.hole_number === n && s.confirmed)
                    return <ScoreCell key={round} score={hs?.score ?? null} par={par} />
                  })}
                </tr>
              )
            })}
            {/* Totals row */}
            <tr className="bg-[#1a4d2e]">
              <td className="pl-4 pr-2 py-2 text-xs font-bold text-white" colSpan={2}>Total</td>
              {([1, 2, 3, 4] as const).map((round) => {
                const vp = roundVsPar(round)
                return (
                  <td key={round} className="text-center px-1 py-2">
                    {vp !== null ? (
                      <span className={`text-xs font-bold font-score ${scoreColour(vp)}`}>
                        {scoreLabel(vp)}
                      </span>
                    ) : (
                      <span className="text-[#3d5c40] text-xs">—</span>
                    )}
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Bio */}
      {espnProfile && (
        <div className="px-4 py-4 border-b border-[#1a3d2b]">
          <h3 className="text-xs font-bold text-[#8ab89a] uppercase tracking-wide mb-3">Biography</h3>
          <div className="space-y-2.5">
            {age && (
              <div className="flex justify-between text-sm">
                <span className="text-[#5a7a65]">Age</span>
                <span className="text-white font-medium">{age}</span>
              </div>
            )}
            {espnProfile.birthPlace?.city && (
              <div className="flex justify-between text-sm">
                <span className="text-[#5a7a65]">Birthplace</span>
                <span className="text-white font-medium text-right">
                  {[espnProfile.birthPlace.city, espnProfile.birthPlace.country].filter(Boolean).join(', ')}
                </span>
              </div>
            )}
            {espnProfile.college && (
              <div className="flex justify-between text-sm">
                <span className="text-[#5a7a65]">College</span>
                <span className="text-white font-medium text-right">{espnProfile.college}</span>
              </div>
            )}
            {espnProfile.displayHeight && (
              <div className="flex justify-between text-sm">
                <span className="text-[#5a7a65]">Height</span>
                <span className="text-white font-medium">{espnProfile.displayHeight}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Price history */}
      <div className="px-4 py-4 border-b border-[#1a3d2b]">
        <h3 className="text-xs font-bold text-[#8ab89a] uppercase tracking-wide mb-3">Price History</h3>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'R1', price: player.price_r1 },
            { label: 'R2', price: player.price_r2 },
            { label: 'R3', price: player.price_r3 },
            { label: 'R4', price: player.price_r4 },
          ].map(({ label, price }) => (
            <div key={label} className="bg-[#1a3d2b] rounded-xl p-2.5 text-center">
              <div className="text-sm font-score font-bold text-[#c9a227]">
                {price != null ? `£${price}m` : '—'}
              </div>
              <div className="text-[9px] text-[#5a7a65] uppercase mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="h-24" />
    </div>
  )
}
