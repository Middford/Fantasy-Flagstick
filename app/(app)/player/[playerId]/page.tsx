import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft, Globe, TrendingUp } from 'lucide-react'

interface EspnAthleteProfile {
  displayName?: string
  dateOfBirth?: string
  birthPlace?: { city?: string; country?: string }
  college?: string
  professional?: boolean
  active?: boolean
  headshot?: { href: string }
}

async function fetchEspnProfile(espnId: string): Promise<EspnAthleteProfile | null> {
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

function scoreLabel(score: number): string {
  if (score === 0) return 'E'
  return score > 0 ? `+${score}` : `${score}`
}

function scoreColour(score: number): string {
  if (score < 0) return 'text-[#4adb7a]'
  if (score > 0) return 'text-[#e05555]'
  return 'text-white'
}

function ageFromDob(dob: string): number | null {
  try {
    const birth = new Date(dob)
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
    return age
  } catch {
    return null
  }
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

  const { data: player } = await db
    .from('players')
    .select('*')
    .eq('id', playerId)
    .single()

  if (!player) notFound()

  // Fetch ESPN profile if we have an ESPN ID
  const espnProfile = player.espn_id ? await fetchEspnProfile(player.espn_id) : null

  // Headshot URL — ESPN CDN pattern
  const headshotUrl = player.espn_id
    ? `https://a.espncdn.com/i/headshots/golf/players/full/${player.espn_id}.png`
    : null

  // Country flag emoji (simple lookup for golf's common nations)
  const countryFlags: Record<string, string> = {
    USA: '🇺🇸', ENG: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', SCO: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', WAL: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', IRL: '🇮🇪',
    ESP: '🇪🇸', RSA: '🇿🇦', AUS: '🇦🇺', JPN: '🇯🇵', KOR: '🇰🇷',
    NOR: '🇳🇴', SWE: '🇸🇪', CAN: '🇨🇦', ARG: '🇦🇷', COL: '🇨🇴',
    GER: '🇩🇪', FRA: '🇫🇷', BEL: '🇧🇪', CHN: '🇨🇳', NZL: '🇳🇿',
    ZIM: '🇿🇼', FIJ: '🇫🇯', VEN: '🇻🇪', CZE: '🇨🇿', SVK: '🇸🇰',
    ITA: '🇮🇹', DEN: '🇩🇰', AUT: '🇦🇹',
  }
  const flag = countryFlags[player.country] ?? '🌍'

  // Price direction display
  const priceArrow =
    player.price_direction === 'up' ? '↑' :
    player.price_direction === 'down' ? '↓' : '—'
  const priceColour =
    player.price_direction === 'up' ? 'text-[#4adb7a]' :
    player.price_direction === 'down' ? 'text-[#e05555]' : 'text-[#5a7a65]'

  const birthYear = espnProfile?.dateOfBirth
    ? new Date(espnProfile.dateOfBirth).getFullYear()
    : null
  const age = espnProfile?.dateOfBirth ? ageFromDob(espnProfile.dateOfBirth) : null

  // Price change from R1
  const priceChange = player.current_price - player.price_r1
  const priceChangeStr =
    priceChange === 0 ? 'No change' :
    priceChange > 0 ? `+£${priceChange}m since R1` :
    `-£${Math.abs(priceChange)}m since R1`

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0a1a10] border-b border-[#1a3d2b] px-4 py-3 flex items-center gap-3">
        <Link href="/picks" className="text-[#8ab89a] active:opacity-60">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-base font-bold text-[#c9a227] truncate">{player.name_full}</h1>
      </header>

      {/* Hero */}
      <div className="flex items-end gap-4 px-4 pt-5 pb-4 border-b border-[#1a3d2b] bg-gradient-to-b from-[#0f2518] to-[#0a1a10]">
        {/* Headshot */}
        <div className="flex-shrink-0 w-24 h-24 rounded-2xl overflow-hidden bg-[#1a3d2b] border border-[#2d5c3f]">
          {headshotUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={headshotUrl}
              alt={player.name_full}
              className="w-full h-full object-cover object-top"
              onError={() => {}}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl">🏌️</div>
          )}
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0 pb-1">
          <h2 className="text-xl font-bold text-white leading-tight">{player.name_full}</h2>
          <p className="text-sm text-[#8ab89a] mt-0.5">
            {flag} {player.country}
            {age ? ` · Age ${age}` : ''}
          </p>
          {player.world_ranking && (
            <p className="text-xs text-[#5a7a65] mt-0.5">World Ranking #{player.world_ranking}</p>
          )}
          <div className={`mt-1 text-sm font-bold font-score flex items-center gap-1.5 ${priceColour}`}>
            <span>{priceArrow}</span>
            <span className="text-[#c9a227]">£{player.current_price}m</span>
            <span className="text-xs font-normal text-[#5a7a65]">{priceChangeStr}</span>
          </div>
        </div>
      </div>

      {/* Tournament performance */}
      <div className="px-4 py-4 border-b border-[#1a3d2b]">
        <h3 className="text-xs font-bold text-[#8ab89a] uppercase tracking-wide mb-3">
          Tournament Form
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#1a3d2b] rounded-xl p-3 text-center">
            <div className={`text-2xl font-score font-bold ${scoreColour(player.total_score)}`}>
              {scoreLabel(player.total_score)}
            </div>
            <div className="text-[10px] text-[#8ab89a] uppercase tracking-wide mt-0.5">Total</div>
          </div>
          <div className="bg-[#1a3d2b] rounded-xl p-3 text-center">
            <div className={`text-2xl font-score font-bold ${scoreColour(player.current_round_score)}`}>
              {player.holes_completed > 0 ? scoreLabel(player.current_round_score) : '—'}
            </div>
            <div className="text-[10px] text-[#8ab89a] uppercase tracking-wide mt-0.5">Today</div>
          </div>
          <div className="bg-[#1a3d2b] rounded-xl p-3 text-center">
            <div className="text-2xl font-score font-bold text-white">
              {player.holes_completed > 0 ? player.holes_completed : '—'}
            </div>
            <div className="text-[10px] text-[#8ab89a] uppercase tracking-wide mt-0.5">Holes</div>
          </div>
        </div>

        {player.status !== 'active' && (
          <div className="mt-3 px-3 py-2 rounded-lg bg-[#3d1a1a] border border-[#5c2d2d] text-center">
            <span className="text-sm font-bold text-[#e05555]">
              {player.status === 'cut' ? '✂️ Cut' :
               player.status === 'wd' ? '🚫 Withdrawn' :
               player.status === 'dq' ? '⛔ Disqualified' : player.status}
            </span>
          </div>
        )}
      </div>

      {/* Price history */}
      <div className="px-4 py-4 border-b border-[#1a3d2b]">
        <h3 className="text-xs font-bold text-[#8ab89a] uppercase tracking-wide mb-3">
          Price History
        </h3>
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

      {/* ESPN bio */}
      {espnProfile && (
        <div className="px-4 py-4 border-b border-[#1a3d2b]">
          <h3 className="text-xs font-bold text-[#8ab89a] uppercase tracking-wide mb-3">
            Biography
          </h3>
          <div className="space-y-2">
            {birthYear && (
              <div className="flex justify-between text-sm">
                <span className="text-[#8ab89a]">Born</span>
                <span className="text-white">{birthYear}</span>
              </div>
            )}
            {espnProfile.birthPlace?.city && (
              <div className="flex justify-between text-sm">
                <span className="text-[#8ab89a]">Birthplace</span>
                <span className="text-white text-right">
                  {[espnProfile.birthPlace.city, espnProfile.birthPlace.country]
                    .filter(Boolean).join(', ')}
                </span>
              </div>
            )}
            {espnProfile.college && (
              <div className="flex justify-between text-sm">
                <span className="text-[#8ab89a]">College</span>
                <span className="text-white text-right">{espnProfile.college}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer spacer for bottom nav */}
      <div className="h-24" />
    </div>
  )
}
