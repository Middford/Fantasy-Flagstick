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

interface TeeTime { r1: string | null; r2: string | null }

interface PickScreenProps {
  userId: string
  leagueId: string
  tournamentId: string
  round: number
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

  // Sync scores every 30s from client — replaces Vercel Cron (Hobby plan limitation)
  useScoreSync(true)

  const postmanKey = `postman_r${round}_player_id` as keyof Chips
  const postmanPlayerId = chips ? (chips[postmanKey] as string | null) : null

  // Budget calculation
  const roundPicks = picks.filter((p) => p.round === round)
  const { remaining, totalBudget } = chips
    ? calculateRemainingBudget(picks, chips, round)
    : { remaining: 100, totalBudget: 100 }
  const holesLeft = 18 - roundPicks.length

  // Player uses map
  const usesMap = new Map<string, number>()
  players.forEach((p) => usesMap.set(p.id, getPlayerUseCount(picks, p.id, round)))

  // Who has completed hole N-1 (locked out for hole N)
  const lockedOutMap = new Map<string, boolean>()

  // Current pick for selected hole
  const currentPick = roundPicks.find((p) => p.hole_number === selectedHole)

  // Subscribe to realtime price and score updates
  useEffect(() => {
    const channel = supabase
      .channel('picks-live')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'players', filter: `tournament_id=eq.${tournamentId}` },
        (payload) => {
          setPlayers((prev) =>
            prev.map((p) => (p.id === payload.new.id ? { ...p, ...payload.new } : p))
          )
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'picks', filter: `user_id=eq.${userId}` },
        () => refreshPicks()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tournamentId, userId]) // eslint-disable-line react-hooks/exhaustive-deps

  const refreshPicks = useCallback(async () => {
    const { data } = await supabase
      .from('picks')
      .select('*')
      .eq('user_id', userId)
      .eq('league_id', leagueId)
      .eq('round', round)
    if (data) setPicks(data)
  }, [supabase, userId, leagueId, round])

  async function handlePick(player: Player) {
    if (saving) return
    setSaving(true)

    // Can't pick if it would exceed budget
    const playerCost = currentPick ? player.current_price - currentPick.price_paid : player.current_price
    if (playerCost > remaining && !currentPick) {
      setSaving(false)
      return
    }

    const selectedHole_ = selectedHole

    const { error } = await supabase.from('picks').upsert(
      {
        league_id: leagueId,
        user_id: userId,
        tournament_id: tournamentId,
        round,
        hole_number: selectedHole_,
        player_id: player.id,
        price_paid: player.current_price,
        is_postman: player.id === postmanPlayerId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'league_id,user_id,round,hole_number' }
    )

    if (!error) {
      await refreshPicks()
      // Auto-advance to next unpicked hole
      const nextUnpicked = Array.from({ length: 18 }, (_, i) => i + 1).find(
        (h) => h !== selectedHole_ && !picks.find((p) => p.round === round && p.hole_number === h)
      )
      if (nextUnpicked) setSelectedHole(nextUnpicked)
    }

    setSaving(false)
  }

  async function handleSponsorshipDeal() {
    if (!chips || chips.sponsorship_used) return
    const { error } = await supabase
      .from('chips')
      .update({ sponsorship_used: true, sponsorship_round: round })
      .eq('id', chips.id)
    if (!error) {
      setChips({ ...chips, sponsorship_used: true, sponsorship_round: round })
    }
  }

  async function handleMulligan() {
    // Open mulligan UI — for now just a placeholder
    alert('Select a locked hole to Mulligan. Replacement player must not have completed that hole.')
  }

  const selectedHoleData = initialHoles.find((h) => h.number === selectedHole)

  return (
    <div className="flex flex-col">
      {/* Budget bar */}
      <BudgetBar remaining={remaining} total={totalBudget} holesLeft={holesLeft} />

      {/* Chips */}
      <ChipsPanel
        chips={chips}
        round={round}
        players={players}
        onUseSponsorshipDeal={handleSponsorshipDeal}
        onSelectPostman={() => {}}
        onUseMulligan={handleMulligan}
      />

      {/* Hole grid */}
      <HoleGrid
        holes={initialHoles}
        picks={picks}
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
          {currentPick && (
            <div className="mt-1 text-[11px] text-[#c9a227]">
              Current pick: {players.find((p) => p.id === currentPick.player_id)?.name} · £{currentPick.price_paid}m
              {currentPick.is_locked && ' · 🔒 Locked'}
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
        postmanPlayerId={postmanPlayerId}
        completedHoleScores={lockedOutMap}
        teeTimes={teeTimes}
        onPick={handlePick}
      />
    </div>
  )
}
