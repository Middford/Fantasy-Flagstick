'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Player, Hole, Pick, Chips } from '@/lib/supabase/types'
import { calculateRemainingBudget, getPlayerUseCount } from '@/lib/scoring/calculator'
import { useScoreSync } from '@/hooks/useScoreSync'
import BudgetBar from './BudgetBar'
import ChipsPanel from './ChipsPanel'
import HoleGrid from './HoleGrid'
import PlayerList from './PlayerList'

interface HoleStatEntry {
  hole: number
  avg: number | null
  birdie_pct: number | null
  par_pct: number | null
  bogey_pct: number | null
}

interface TeeTime { r1: string | null; r2: string | null; r3: string | null; r4: string | null }

interface PickScreenProps {
  userId: string
  leagueId: string
  tournamentId: string
  round: number
  currentRound: number
  initialHoles: Hole[]
  initialPlayers: Player[]
  initialPicks: Pick[]
  initialChips: Chips | null
  teeTimes?: Record<string, TeeTime>
}

export default function PickScreen({
  userId,
  leagueId,
  tournamentId,
  round,
  currentRound,
  initialHoles,
  initialPlayers,
  initialPicks,
  initialChips,
  teeTimes,
}: PickScreenProps) {
  const supabase = createClient()
  const [players, setPlayers] = useState<Player[]>(initialPlayers)
  const [picks, setPicks] = useState<Pick[]>(initialPicks)
  const [chips, setChips] = useState<Chips | null>(initialChips)
  const [selectedHole, setSelectedHole] = useState<number>(1)
  const [saving, setSaving] = useState(false)
  const [postmanPickerOpen, setPostmanPickerOpen] = useState(false)
  const [sponsorError, setSponsorError] = useState<string | null>(null)

  // DataGolf secondary data
  const [winPctMap, setWinPctMap] = useState<Map<string, number>>(new Map())
  const [holeStats, setHoleStats] = useState<HoleStatEntry[]>([])

  // Sync scores every 30s — only fire when viewing the live round (no point syncing past rounds)
  useScoreSync(round === currentRound)

  const postmanKey = `postman_r${round}_player_id` as keyof Chips
  const postmanPlayerId = chips ? (chips[postmanKey] as string | null) : null

  // Is any pick for this round locked? (freezes sponsor chip state)
  const firstPickLocked = picks.some((p) => p.round === round && p.is_locked)

  // Budget calculation
  const roundPicks = picks.filter((p) => p.round === round)
  const { remaining, totalBudget } = chips
    ? calculateRemainingBudget(picks, chips, round)
    : { remaining: 180, totalBudget: 180 }
  const holesLeft = 18 - roundPicks.length

  // Player uses map
  const usesMap = new Map<string, number>()
  players.forEach((p) => usesMap.set(p.id, getPlayerUseCount(picks, p.id, round)))

  // A player is locked out for hole N if they've already completed it.
  // players.holes_completed is cumulative for the round (holes played in order 1-18).
  const lockedOutMap = new Map<string, boolean>()
  players.forEach((p) => {
    lockedOutMap.set(p.id, p.holes_completed >= selectedHole)
  })

  // Current pick for selected hole
  const currentPick = roundPicks.find((p) => p.hole_number === selectedHole)

  // Subscribe to realtime player price/score updates (picks now go via API route)
  useEffect(() => {
    const channel = supabase
      .channel('players-live')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'players', filter: `tournament_id=eq.${tournamentId}` },
        (payload) => {
          setPlayers((prev) =>
            prev.map((p) => (p.id === payload.new.id ? { ...p, ...payload.new } : p))
          )
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tournamentId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch DataGolf predictions (win%)
  useEffect(() => {
    async function fetchPredictions() {
      try {
        const res = await fetch('/api/datagolf/predictions')
        if (!res.ok) return
        const json = await res.json()
        const map = new Map<string, number>()
        for (const p of json.players ?? []) {
          if (p.dg_id && p.win_pct != null) map.set(p.dg_id, p.win_pct)
        }
        setWinPctMap(map)
      } catch { /* silent failure */ }
    }
    fetchPredictions()
  }, [])

  // Fetch DataGolf live hole stats
  useEffect(() => {
    async function fetchHoleStats() {
      try {
        const res = await fetch('/api/datagolf/hole-stats')
        if (!res.ok) return
        const json = await res.json()
        setHoleStats(json.holes ?? [])
      } catch { /* silent failure */ }
    }
    fetchHoleStats()
  }, [])

  // Fetch picks via API (browser client has no auth → direct Supabase calls are RLS-blocked)
  const refreshPicks = useCallback(async () => {
    const res = await fetch(`/api/picks?leagueId=${leagueId}&round=${round}`)
    if (res.ok) {
      const data = await res.json()
      if (data.picks) setPicks(data.picks)
    }
  }, [leagueId, round])

  async function handlePick(player: Player) {
    if (saving) return
    // Prevent swapping a locked pick
    if (currentPick?.is_locked) return
    setSaving(true)

    // Net cost: new price minus refund from the pick being replaced (0 if no existing pick)
    const playerCost = player.current_price - (currentPick?.price_paid ?? 0)
    if (playerCost > remaining) {
      setSaving(false)
      return
    }

    const selectedHole_ = selectedHole

    const res = await fetch('/api/picks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leagueId,
        tournamentId,
        round,
        holeNumber: selectedHole_,
        playerId: player.id,
        pricePaid: player.current_price,
        isPostman: player.id === postmanPlayerId,
      }),
    })

    if (res.ok) {
      const data = await res.json()
      if (data.picks) {
        setPicks(data.picks)
        // Auto-advance to next unpicked hole
        const nextUnpicked = Array.from({ length: 18 }, (_, i) => i + 1).find(
          (h) => h !== selectedHole_ && !data.picks.find((p: Pick) => p.round === round && p.hole_number === h)
        )
        if (nextUnpicked) setSelectedHole(nextUnpicked)
      }
    }

    setSaving(false)
  }

  async function handleSponsorshipDeal() {
    if (!chips) return
    setSponsorError(null)
    const res = await fetch('/api/chips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sponsorship_toggle', round, chipsId: chips.id, leagueId }),
    })
    if (res.status === 409) {
      const data = await res.json()
      if (data.error === 'over_budget') {
        setSponsorError(data.message)
      }
      return
    }
    if (res.ok) {
      const data = await res.json()
      setChips({ ...chips, sponsorship_used: data.sponsorship_used, sponsorship_round: data.sponsorship_round ?? null })
    }
  }

  async function handleRemovePick(holeNumber: number) {
    if (saving) return
    setSaving(true)
    const res = await fetch(
      `/api/picks?leagueId=${leagueId}&round=${round}&holeNumber=${holeNumber}`,
      { method: 'DELETE' }
    )
    if (res.ok) {
      const data = await res.json()
      if (data.picks) setPicks(data.picks)
    }
    setSaving(false)
  }

  async function handleSelectPostman(playerId: string) {
    if (!chips) return
    const res = await fetch('/api/chips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'postman', round, playerId, chipsId: chips.id }),
    })
    if (res.ok) {
      const key = `postman_r${round}_player_id` as keyof Chips
      setChips({ ...chips, [key]: playerId })
    }
    setPostmanPickerOpen(false)
  }

  async function handleMulligan() {
    alert('Mulligan coming soon — swap a locked pick for a player who hasn\'t completed that hole yet.')
  }

  const selectedHoleData = initialHoles.find((h) => h.number === selectedHole)

  const allPicked = roundPicks.length === 18

  const isPastRound = round < currentRound

  return (
    <div className="flex flex-col">
      {/* Past round read-only banner */}
      {isPastRound && (
        <div className="mx-4 mt-3 px-3 py-2.5 rounded-xl bg-[#0f2518] border border-[#2d5c3f] flex items-center gap-2">
          <span className="text-sm">📋</span>
          <p className="text-[11px] text-[#8ab89a]">
            Round {round} complete — viewing your scores
          </p>
        </div>
      )}

      {/* Budget bar */}
      <BudgetBar remaining={remaining} total={totalBudget} holesLeft={holesLeft} />

      {/* Save status — auto-save happens on every pick tap */}
      <div className={`px-4 py-1.5 flex items-center justify-end gap-1.5 text-[11px] transition-colors
        ${saving ? 'text-[#c9a227]' : allPicked ? 'text-[#4adb7a]' : 'text-[#5a7a65]'}`}>
        {saving ? (
          <>
            <span className="inline-block w-2 h-2 rounded-full bg-[#c9a227] animate-pulse" />
            Saving...
          </>
        ) : allPicked ? (
          <>✓ Team saved — all 18 holes picked</>
        ) : (
          <>Picks save automatically</>
        )}
      </div>

      {/* Sponsor error message */}
      {sponsorError && (
        <div className="mx-4 mt-2 px-3 py-2.5 rounded-xl bg-[#3d1a00] border border-[#7a3a00] flex items-start gap-2">
          <span className="text-base flex-shrink-0">⚠️</span>
          <div className="flex-1">
            <p className="text-[11px] text-[#e8a020] leading-snug">{sponsorError}</p>
          </div>
          <button onClick={() => setSponsorError(null)} className="text-[#5a7a65] text-sm leading-none">✕</button>
        </div>
      )}

      {/* Chips */}
      <ChipsPanel
        chips={chips}
        round={round}
        players={players}
        firstPickLocked={firstPickLocked}
        onUseSponsorshipDeal={handleSponsorshipDeal}
        onSelectPostman={() => setPostmanPickerOpen(true)}
        onUseMulligan={handleMulligan}
      />

      {/* Hole grid */}
      <HoleGrid
        holes={initialHoles}
        picks={picks}
        players={players}
        selectedHole={selectedHole}
        postmanPlayerId={postmanPlayerId}
        onSelectHole={setSelectedHole}
      />

      {/* Selected hole info */}
      {selectedHoleData && (
        <div className="px-4 py-3 border-b border-[#1a3d2b] bg-[#0f2518]">
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-[#8ab89a]">Hole {selectedHoleData.number}</span>
            <h2 className="text-lg font-bold text-white">{selectedHoleData.name}</h2>
          </div>
          <div className="flex gap-4 mt-1">
            <span className="text-[11px] text-[#8ab89a]">Par {selectedHoleData.par}</span>
            <span className="text-[11px] text-[#8ab89a]">{selectedHoleData.yards} yds</span>
            {selectedHoleData.water_hazard && (
              <span className="text-[11px] text-[#4a90d9]">🌊 Water</span>
            )}
            {selectedHoleData.birdie_pct && (
              <span className="text-[11px] text-[#8ab89a]">{selectedHoleData.birdie_pct}% birdie rate</span>
            )}
          </div>
          {/* DG live hole scoring distributions */}
          {(() => {
            const dgHole = holeStats.find((h) => h.hole === selectedHole)
            if (!dgHole || (dgHole.avg === null && dgHole.birdie_pct === null)) return null
            return (
              <div className="flex gap-3 mt-1.5 flex-wrap">
                {dgHole.avg !== null && (
                  <span className="text-[11px] text-[#8ab89a]">
                    Avg {dgHole.avg > 0 ? '+' : ''}{dgHole.avg.toFixed(2)} vs par
                  </span>
                )}
                {dgHole.birdie_pct !== null && (
                  <span className="text-[11px] text-[#4adb7a]">
                    {Math.round(dgHole.birdie_pct * 100)}% birdie
                  </span>
                )}
                {dgHole.par_pct !== null && (
                  <span className="text-[11px] text-[#8ab89a]">
                    {Math.round(dgHole.par_pct * 100)}% par
                  </span>
                )}
                {dgHole.bogey_pct !== null && (
                  <span className="text-[11px] text-[#e05555]">
                    {Math.round(dgHole.bogey_pct * 100)}% bogey
                  </span>
                )}
              </div>
            )
          })()}
          {currentPick && (
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-[11px] text-[#c9a227] flex-1">
                Current pick: {players.find((p) => p.id === currentPick.player_id)?.name} · £{currentPick.price_paid}m
                {currentPick.is_locked && ' · 🔒 Locked'}
              </span>
              {!currentPick.is_locked && (
                <button
                  onClick={() => handleRemovePick(selectedHole)}
                  className="flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-bold text-[#e05555] border border-[#e05555]/40 active:bg-[#e05555]/10"
                >
                  ✕ Remove
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Player list */}
      <PlayerList
        players={players}
        holeNumber={selectedHole}
        round={round}
        picks={usesMap}
        remainingBudget={remaining}
        currentPickPlayerId={currentPick?.player_id ?? null}
        currentPickPricePaid={currentPick?.price_paid ?? 0}
        currentPickLocked={currentPick?.is_locked ?? false}
        postmanPlayerId={postmanPlayerId}
        completedHoleScores={lockedOutMap}
        teeTimes={teeTimes}
        winPctMap={winPctMap}
        onPick={handlePick}
      />

      {/* Postman picker — bottom sheet */}
      {postmanPickerOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setPostmanPickerOpen(false)}
          />
          {/* Sheet */}
          <div className="relative bg-[#0a1a10] rounded-t-2xl max-h-[75vh] flex flex-col">
            <div className="px-4 py-4 border-b border-[#1a3d2b]">
              <h2 className="text-base font-bold text-white">📮 Choose your Postman</h2>
              <p className="text-xs text-[#8ab89a] mt-0.5">
                Their score will be doubled on every hole you pick them this round
              </p>
            </div>
            <div className="overflow-y-auto flex-1 divide-y divide-[#1a3d2b]">
              {[...players]
                .filter((p) => p.status === 'active')
                .sort((a, b) => a.current_price - b.current_price)
                .map((player) => (
                  <button
                    key={player.id}
                    onClick={() => handleSelectPostman(player.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 active:bg-[#1a3d2b] text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{player.name}</p>
                      <p className="text-[11px] text-[#8ab89a]">{player.country}</p>
                    </div>
                    <span className="text-sm font-score font-bold text-[#c9a227]">
                      £{player.current_price}m
                    </span>
                  </button>
                ))}
            </div>
            <button
              onClick={() => setPostmanPickerOpen(false)}
              className="m-4 py-3 text-sm font-bold text-[#8ab89a] border border-[#2d5c3f] rounded-xl"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
