// Fantasy Flagstick — Pricing Engine
// Combines DataGolf win probability, performance, and demand signals

// ============================================================
// BASE PRICE (set once before round starts, from DataGolf)
// ============================================================

/** Convert DataGolf win probability to £m price tier */
export function calculateBasePrice(winProbability: number): number {
  if (winProbability >= 0.15) return 16
  if (winProbability >= 0.10) return 14
  if (winProbability >= 0.07) return 12
  if (winProbability >= 0.05) return 10
  if (winProbability >= 0.03) return 8
  if (winProbability >= 0.02) return 6
  if (winProbability >= 0.01) return 4
  if (winProbability >= 0.005) return 3
  if (winProbability >= 0.002) return 2
  return 1
}

// ============================================================
// MID-ROUND DYNAMIC ADJUSTMENTS
// ============================================================

/**
 * Calculate price from a base price + cumulative round performance.
 *
 * Design goals:
 * - Called once per sync with the player's BASE price (price at round start)
 *   and their TOTAL score vs par for the round so far
 * - Each stroke under par adds ~£0.3m, each stroke over par subtracts ~£0.3m
 * - Confidence weight: adjustments are proportional to holes completed so
 *   early-round scores have less impact than late-round scores
 * - Max swing: ±£6m over a full round (e.g. shooting -8 from a £10 base → ~£14)
 *
 * IMPORTANT: pass `basePrice` (the price BEFORE this round started), not the
 * current live price — otherwise adjustments compound on themselves.
 */
export function calculateRoundPrice(
  basePrice: number,
  currentRoundScore: number,
  holesCompleted: number
): number {
  if (holesCompleted === 0) return basePrice
  // £0.3m per stroke, scaled by progress through round
  const progressWeight = holesCompleted / 18
  const adjustment = -currentRoundScore * 0.3 * progressWeight
  return basePrice + adjustment
}

/**
 * Demand adjustment — one-time bump applied when round opens.
 * NOT applied per-hole (would stack to insane values).
 * Called once at round start to set the opening price.
 */
export function calculateDemandAdjustment(pickPercentage: number): number {
  if (pickPercentage >= 0.40) return 1.0
  if (pickPercentage >= 0.25) return 0.5
  if (pickPercentage >= 0.10) return 0.25
  return 0
}

/**
 * @deprecated Use calculateRoundPrice instead.
 * Kept for API compatibility — maps to calculateRoundPrice semantics.
 */
export function calculatePerformanceAdjustment(
  basePrice: number,
  scoreVsPar: number,
  holesCompleted: number
): number {
  return calculateRoundPrice(basePrice, scoreVsPar, holesCompleted) - basePrice
}

/**
 * Odds movement adjustment — based on DataGolf live probability change.
 */
export function calculateOddsMovement(
  preRoundProb: number,
  currentProb: number
): number {
  const delta = currentProb - preRoundProb
  return delta * 20
}

/**
 * Apply all signals and return new clamped, rounded price.
 */
export function applyPriceUpdate(
  currentPrice: number,
  performanceAdj: number,
  demandAdj: number,
  oddsMovement: number
): number {
  const rawPrice = currentPrice + performanceAdj + demandAdj + oddsMovement
  const rounded = Math.round(rawPrice * 2) / 2   // Round to nearest £0.5m
  return Math.max(1, Math.min(20, rounded))
}

/**
 * Determine price direction indicator.
 */
export function getPriceDirection(
  oldPrice: number,
  newPrice: number
): 'up' | 'down' | 'flat' {
  if (newPrice > oldPrice + 0.4) return 'up'
  if (newPrice < oldPrice - 0.4) return 'down'
  return 'flat'
}

// ============================================================
// BEAT THE BOOKIE CALCULATIONS
// ============================================================

/**
 * Performance index: how much has a player outperformed/underperformed
 * their pre-tournament win probability.
 * Positive = outperforming, Negative = underperforming.
 */
export function calculatePerformanceIndex(
  preRoundProb: number,
  currentProb: number
): number {
  if (preRoundProb === 0) return 0
  return ((currentProb - preRoundProb) / preRoundProb) * 100
}

/**
 * Convert win probability to implied odds string (e.g. "40/1")
 */
export function impliedOddsDisplay(probability: number): string {
  if (probability <= 0) return '999/1'
  const decimal = 1 / probability
  const oddsNum = decimal - 1
  // Simple fractional approximations
  if (oddsNum < 1) return `${Math.round(oddsNum * 4)}/4`
  const rounded = Math.round(oddsNum)
  return `${rounded}/1`
}

/**
 * Colour for performance index on Beat the Bookie screen
 */
export function getPerformanceColour(index: number): string {
  if (index > 100) return '#4adb7a'   // Massive outperformance
  if (index > 50)  return '#8ab89a'   // Outperforming
  if (index > 0)   return '#c9a227'   // Slight outperformance (gold)
  if (index > -50) return '#e8a020'   // Slight underperformance
  return '#e05555'                     // Significant underperformance
}
