'use client'

import { useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type HoleScorePayload = {
  id: string
  tournament_id: string
  player_id: string
  round: number
  hole_number: number
  score: number | null
  score_vs_par: number | null
  is_water: boolean
  confirmed: boolean
}

type PlayerPayload = {
  id: string
  current_price: number
  price_direction: string
  current_round_score: number
  holes_completed: number
}

interface UseRealtimeOptions {
  tournamentId: string
  onScoreConfirmed?: (payload: HoleScorePayload) => void
  onPriceUpdate?: (payload: PlayerPayload) => void
  onPickChange?: () => void
}

export function useTournamentRealtime({
  tournamentId,
  onScoreConfirmed,
  onPriceUpdate,
  onPickChange,
}: UseRealtimeOptions) {
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel('tournament-live')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'hole_scores',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        (payload) => onScoreConfirmed?.(payload.new as HoleScorePayload)
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'players',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        (payload) => onPriceUpdate?.(payload.new as PlayerPayload)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'picks' },
        () => onPickChange?.()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tournamentId, onScoreConfirmed, onPriceUpdate, onPickChange]) // eslint-disable-line react-hooks/exhaustive-deps
}
