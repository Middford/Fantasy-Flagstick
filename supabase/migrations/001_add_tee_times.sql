-- Migration: Add tee time columns to players table
-- Run in Supabase SQL editor

alter table players
  add column if not exists tee_time_r1 timestamptz,
  add column if not exists tee_time_r2 timestamptz;
