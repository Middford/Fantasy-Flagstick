// Fantasy Flagstick — Score Calculator
// Handles Postman doubling, Mulligan substitution, budget calculation

import type { Pick, Chips } from '@/lib/supabase/types'

export interface ScoredPick extends Pick {
  effective_score_vs_par: number  // After Postman doubling / Mulligan substitution
  is_pending: boolean              // Score not yet confirmed
}

/**
 * Get Postman player ID for a given round from chips row.
 */
export function getPostmanPlayerId(chips: Chips, round: number): string | null {
  const key = `postman_r${round}_player_id` as keyof Chips
  return (chips[key] as string | null) ?? null
}

/**
 * Score a single pick — applies Postman doubling if applicable.
 * Returns effective score vs par.
 * Returns null if score not yet confirmed (pending hole).
 */
export function scorePick(
  pick: Pick,
  postmanPlayerId: string | null
): { effectiveScore: number | null; isPending: boolean } {
  if (pick.score_vs_par === null) {
    return { effectiveScore: null, isPending: true }
  }

  const baseScore = pick.is_mulligan_used
    ? pick.score_vs_par  // Mulligan replacement score already stored on pick
    : pick.score_vs_par

  // Apply Postman doubling if this player is the Postman for this round
  const isPostman = postmanPlayerId !== null && pick.player_id === postmanPlayerId
  const effectiveScore = isPostman ? baseScore * 2 : baseScore

  return { effectiveScore, isPending: false }
}

/**
 * Calculate total score for a user's round picks.
 * Excludes pending (unconfirmed) holes.
 */
export function calculateRoundScore(
  picks: Pick[],
  chips: Chips,
  round: number
): {
  totalScore: number
  holesConfirmed: number
  holesPending: number
} {
  const postmanId = getPostmanPlayerId(chips, round)
  let totalScore = 0
  let holesConfirmed = 0
  let holesPending = 0

  picks.forEach((pick) => {
    const { effectiveScore, isPending } = scorePick(pick, postmanId)
    if (isPending) {
      holesPending++
    } else {
      totalScore += effectiveScore!
      holesConfirmed++
    }
  })

  return { totalScore, holesConfirmed, holesPending }
}

/**
 * Calculate remaining budget for a round.
 * Budget = £100m (+ £25m if Sponsorship Deal used this round)
 */
export function calculateRemainingBudget(
  picks: Pick[],
  chips: Chips,
  round: number
): {
  totalBudget: number
  spent: number
  remaining: number
} {
  const BASE_BUDGET = 100
  const SPONSORSHIP_BONUS = 25

  const hasSponsorshipThisRound =
    chips.sponsorship_used && chips.sponsorship_round === round

  const totalBudget = BASE_BUDGET + (hasSponsorshipThisRound ? SPONSORSHIP_BONUS : 0)
  const roundPicks = picks.filter((p) => p.round === round)
  const spent = roundPicks.reduce((sum, p) => sum + p.price_paid, 0)

  return {
    totalBudget,
    spent,
    remaining: totalBudget - spent,
  }
}

/**
 * Check how many times a player has been picked in a round (max 3).
 */
export function getPlayerUseCount(
  picks: Pick[],
  playerId: string,
  round: number
): number {
  return picks.filter(
    (p) => p.player_id === playerId && p.round === round
  ).length
}

/**
 * Sort leaderboard: lower score = better.
 * Tiebreaker: more holes completed = higher rank.
 */
export function sortLeaderboard<
  T extends { totalScore: number; holesConfirmed: number }
>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    if (a.totalScore !== b.totalScore) return a.totalScore - b.totalScore
    return b.holesConfirmed - a.holesConfirmed
  })
}
