// Fantasy Flagstick — Feature Flags
// Pro Mode architecture is scaffolded but NOT built for launch.
// All SHOW_ODDS and SHOW_BOOKMAKER_LINKS features are gated behind age verification.

import { differenceInYears } from 'date-fns'
import type { Profile } from '@/lib/supabase/types'

export const FEATURES = {
  /** Show live bookmaker odds — age-gated, Pro Mode only (FUTURE) */
  SHOW_ODDS: (user: Profile): boolean =>
    user.age_verified &&
    user.pro_mode_enabled &&
    user.date_of_birth !== null &&
    differenceInYears(new Date(), new Date(user.date_of_birth)) >= 18,

  /** Show tap-through affiliate bookmaker links — age-gated (FUTURE) */
  SHOW_BOOKMAKER_LINKS: (user: Profile): boolean =>
    user.age_verified &&
    user.pro_mode_enabled &&
    user.date_of_birth !== null &&
    differenceInYears(new Date(), new Date(user.date_of_birth)) >= 18,

  /** Beat the Bookie tab — available to ALL users (no age gate) */
  SHOW_BEAT_THE_BOOKIE: (_user: Profile): boolean => true,

  /** Extended Sponsorship Deal (+£35m instead of £25m) — Pro Mode only (FUTURE) */
  EXTENDED_CHIPS: (user: Profile): boolean => user.pro_mode_enabled,
}

/** Game constants */
export const GAME = {
  BUDGET_BASE: 100,           // £100m per round
  SPONSORSHIP_BONUS: 25,      // +£25m when Sponsorship Deal used
  MAX_PLAYER_USES: 3,         // Same player max 3 times per round
  PRICE_FLOOR: 1,             // Minimum price £1m
  PRICE_CEILING: 20,          // Maximum price £20m
} as const
