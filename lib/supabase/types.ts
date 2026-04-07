// Fantasy Flagstick — Supabase Database Types
// Clerk user IDs are text ('user_xxx'), not uuid

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
    Tables: {
      tournaments: {
        Row: {
          id: string
          name: string
          year: number
          course: string
          course_short: string
          par: number
          start_date: string
          end_date: string
          current_round: number
          status: 'upcoming' | 'active' | 'complete'
          theme: 'masters' | 'open' | 'usopen' | 'pga'
          active: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['tournaments']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['tournaments']['Insert']>
      }
      holes: {
        Row: {
          id: string
          tournament_id: string
          number: number
          par: number
          name: string
          yards: number
          avg_score: number | null
          birdie_pct: number | null
          eagle_pct: number | null
          bogey_pct: number | null
          water_hazard: boolean
          difficulty_rank: number | null
        }
        Insert: Omit<Database['public']['Tables']['holes']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['holes']['Insert']>
      }
      players: {
        Row: {
          id: string
          tournament_id: string
          name: string
          name_full: string
          country: string
          world_ranking: number | null
          datagolf_id: string | null
          espn_id: string | null
          price_r1: number
          price_r2: number | null
          price_r3: number | null
          price_r4: number | null
          current_price: number
          price_direction: 'up' | 'down' | 'flat'
          tee_time_r1: string | null
          tee_time_r2: string | null
          current_round_score: number
          holes_completed: number
          total_score: number
          status: 'active' | 'cut' | 'wd' | 'dq'
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['players']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['players']['Insert']>
      }
      hole_scores: {
        Row: {
          id: string
          tournament_id: string
          player_id: string
          round: number
          hole_number: number
          score: number | null
          score_vs_par: number | null
          is_water: boolean
          confirmed: boolean
          confirmed_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['hole_scores']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['hole_scores']['Insert']>
      }
      leagues: {
        Row: {
          id: string
          tournament_id: string
          name: string
          code: string
          created_by: string  // Clerk user ID (text)
          type: 'tournament' | 'global'
          max_players: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['leagues']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['leagues']['Insert']>
      }
      league_members: {
        Row: {
          id: string
          league_id: string
          user_id: string  // Clerk user ID (text)
          display_name: string | null
          joined_at: string
        }
        Insert: Omit<Database['public']['Tables']['league_members']['Row'], 'id' | 'joined_at'>
        Update: Partial<Database['public']['Tables']['league_members']['Insert']>
      }
      picks: {
        Row: {
          id: string
          league_id: string
          user_id: string  // Clerk user ID (text)
          tournament_id: string
          round: number
          hole_number: number
          player_id: string
          price_paid: number
          is_locked: boolean
          locked_at: string | null
          score_vs_par: number | null
          is_postman: boolean
          is_mulligan_used: boolean
          mulligan_replacement_player_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['picks']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['picks']['Insert']>
      }
      chips: {
        Row: {
          id: string
          league_id: string
          user_id: string  // Clerk user ID (text)
          tournament_id: string
          sponsorship_used: boolean
          sponsorship_round: number | null
          postman_r1_player_id: string | null
          postman_r2_player_id: string | null
          postman_r3_player_id: string | null
          postman_r4_player_id: string | null
          mulligan_used: boolean
          mulligan_round: number | null
          mulligan_hole: number | null
        }
        Insert: Omit<Database['public']['Tables']['chips']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['chips']['Insert']>
      }
      profiles: {
        Row: {
          id: string  // Clerk user ID (text)
          display_name: string | null
          avatar_emoji: string
          total_majors_played: number
          all_time_score: number
          age_verified: boolean
          date_of_birth: string | null
          age_verified_at: string | null
          pro_mode_enabled: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      trophies: {
        Row: {
          id: string
          user_id: string  // Clerk user ID (text)
          tournament_id: string
          league_id: string
          type: string
          name: string
          detail: string | null
          year: number
          earned_at: string
        }
        Insert: Omit<Database['public']['Tables']['trophies']['Row'], 'id' | 'earned_at'>
        Update: Partial<Database['public']['Tables']['trophies']['Insert']>
      }
      beat_the_bookie: {
        Row: {
          id: string
          tournament_id: string
          player_id: string
          round: number
          pre_round_prob: number | null
          current_prob: number | null
          performance_index: number | null
          direction: 'up' | 'down' | null
          pre_round_odds_display: string | null
          current_odds_display: string | null
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['beat_the_bookie']['Row'], 'id' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['beat_the_bookie']['Insert']>
      }
    }
  }
}

// Convenience type aliases
export type Tournament = Database['public']['Tables']['tournaments']['Row']
export type Hole = Database['public']['Tables']['holes']['Row']
export type Player = Database['public']['Tables']['players']['Row']
export type HoleScore = Database['public']['Tables']['hole_scores']['Row']
export type League = Database['public']['Tables']['leagues']['Row']
export type LeagueMember = Database['public']['Tables']['league_members']['Row']
export type Pick = Database['public']['Tables']['picks']['Row']
export type Chips = Database['public']['Tables']['chips']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Trophy = Database['public']['Tables']['trophies']['Row']
export type BeatTheBookie = Database['public']['Tables']['beat_the_bookie']['Row']
