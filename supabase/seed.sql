-- Fantasy Flagstick — Seed Data
-- Masters 2026 — Augusta National
-- Run AFTER schema.sql

-- ============================================================
-- TOURNAMENT
-- ============================================================
insert into tournaments (name, year, course, course_short, par, start_date, end_date, current_round, status, theme, active)
values (
  'The Masters', 2026, 'Augusta National Golf Club', 'Augusta',
  72, '2026-04-10', '2026-04-13', 1, 'active', 'masters', true
);

-- ============================================================
-- HOLES — Augusta National 2026
-- All 18 holes with names, pars, yards, and historical stats
-- ============================================================
insert into holes (tournament_id, number, par, name, yards, avg_score, birdie_pct, eagle_pct, bogey_pct, water_hazard, difficulty_rank)
values
  ((select id from tournaments where year=2026 and theme='masters'), 1,  4, 'Tea Olive',        445, 0.12,  28.1, 0.1,  18.2, false, 9),
  ((select id from tournaments where year=2026 and theme='masters'), 2,  5, 'Pink Dogwood',     575, -0.31, 42.1, 3.2,  12.1, false, 15),
  ((select id from tournaments where year=2026 and theme='masters'), 3,  4, 'Flowering Peach',  350, -0.08, 30.2, 0.2,  16.8, false, 12),
  ((select id from tournaments where year=2026 and theme='masters'), 4,  3, 'Palm',             240, 0.21,  18.1, 0.0,  28.4, false, 4),
  ((select id from tournaments where year=2026 and theme='masters'), 5,  4, 'Magnolia',         495, 0.18,  22.3, 0.1,  24.1, false, 6),
  ((select id from tournaments where year=2026 and theme='masters'), 6,  3, 'Juniper',          180, 0.09,  24.1, 0.1,  20.3, false, 10),
  ((select id from tournaments where year=2026 and theme='masters'), 7,  4, 'Pampas',           450, 0.15,  26.2, 0.1,  21.4, false, 8),
  ((select id from tournaments where year=2026 and theme='masters'), 8,  5, 'Yellow Jasmine',   570, -0.28, 40.1, 4.1,  13.2, false, 14),
  ((select id from tournaments where year=2026 and theme='masters'), 9,  4, 'Carolina Cherry',  460, 0.22,  19.8, 0.1,  25.3, false, 5),
  ((select id from tournaments where year=2026 and theme='masters'), 10, 4, 'Camellia',         495, 0.19,  21.2, 0.1,  24.8, false, 7),
  ((select id from tournaments where year=2026 and theme='masters'), 11, 4, 'White Dogwood',    520, 0.31,  18.1, 0.1,  29.2, true,  3),
  ((select id from tournaments where year=2026 and theme='masters'), 12, 3, 'Golden Bell',      155, 0.38,  14.2, 0.2,  32.1, true,  1),
  ((select id from tournaments where year=2026 and theme='masters'), 13, 5, 'Azalea',           510, -0.52, 52.1, 8.2,  10.1, true,  18),
  ((select id from tournaments where year=2026 and theme='masters'), 14, 4, 'Chinese Fir',      440, 0.11,  27.3, 0.1,  18.9, false, 11),
  ((select id from tournaments where year=2026 and theme='masters'), 15, 5, 'Firethorn',        550, -0.48, 50.2, 7.1,  10.8, true,  17),
  ((select id from tournaments where year=2026 and theme='masters'), 16, 3, 'Redbud',           170, 0.14,  22.1, 0.8,  21.2, true,  13),
  ((select id from tournaments where year=2026 and theme='masters'), 17, 4, 'Nandina',          440, 0.16,  24.8, 0.1,  22.1, false, 16),
  ((select id from tournaments where year=2026 and theme='masters'), 18, 4, 'Holly',            465, 0.08,  26.1, 0.2,  18.4, false, 2);

-- ============================================================
-- PLAYERS — Masters 2026 Field
-- Tier 1 (Rank 1-5):   £14-16m
-- Tier 2 (Rank 6-15):  £10-13m
-- Tier 3 (Rank 16-30): £7-9m
-- Tier 4 (Rank 31-50): £4-6m
-- Tier 5 (Field):      £1-3m
-- ============================================================
insert into players (tournament_id, name, name_full, country, world_ranking, price_r1, current_price)
values
  ((select id from tournaments where year=2026 and theme='masters'), 'S. Scheffler',   'Scottie Scheffler',   'USA', 1,  16, 16),
  ((select id from tournaments where year=2026 and theme='masters'), 'R. McIlroy',     'Rory McIlroy',        'NIR', 2,  15, 15),
  ((select id from tournaments where year=2026 and theme='masters'), 'X. Schauffele',  'Xander Schauffele',   'USA', 3,  14, 14),
  ((select id from tournaments where year=2026 and theme='masters'), 'J. Rahm',        'Jon Rahm',            'ESP', 4,  14, 14),
  ((select id from tournaments where year=2026 and theme='masters'), 'C. Morikawa',    'Collin Morikawa',     'USA', 5,  13, 13),
  ((select id from tournaments where year=2026 and theme='masters'), 'T. Fleetwood',   'Tommy Fleetwood',     'ENG', 6,  12, 12),
  ((select id from tournaments where year=2026 and theme='masters'), 'V. Hovland',     'Viktor Hovland',      'NOR', 7,  11, 11),
  ((select id from tournaments where year=2026 and theme='masters'), 'L. Aberg',       'Ludvig Aberg',        'SWE', 8,  11, 11),
  ((select id from tournaments where year=2026 and theme='masters'), 'M. Fitzpatrick', 'Matt Fitzpatrick',    'ENG', 9,  10, 10),
  ((select id from tournaments where year=2026 and theme='masters'), 'S. Lowry',       'Shane Lowry',         'IRL', 10, 10, 10),
  ((select id from tournaments where year=2026 and theme='masters'), 'B. DeChambeau',  'Bryson DeChambeau',   'USA', 11, 10, 10),
  ((select id from tournaments where year=2026 and theme='masters'), 'R. MacIntyre',   'Robert MacIntyre',    'SCO', 12, 9,  9),
  ((select id from tournaments where year=2026 and theme='masters'), 'T. Hatton',      'Tyrrell Hatton',      'ENG', 13, 9,  9),
  ((select id from tournaments where year=2026 and theme='masters'), 'P. Cantlay',     'Patrick Cantlay',     'USA', 14, 8,  8),
  ((select id from tournaments where year=2026 and theme='masters'), 'H. English',     'Harris English',      'USA', 15, 8,  8),
  ((select id from tournaments where year=2026 and theme='masters'), 'A. Scott',       'Adam Scott',          'AUS', 20, 7,  7),
  ((select id from tournaments where year=2026 and theme='masters'), 'S. Power',       'Seamus Power',        'IRL', 25, 6,  6),
  ((select id from tournaments where year=2026 and theme='masters'), 'D. McCarthy',    'Denny McCarthy',      'USA', 30, 5,  5),
  ((select id from tournaments where year=2026 and theme='masters'), 'C. Kirk',        'Chris Kirk',          'USA', 35, 4,  4),
  ((select id from tournaments where year=2026 and theme='masters'), 'J. Day',         'Jason Day',           'AUS', 40, 4,  4),
  ((select id from tournaments where year=2026 and theme='masters'), 'C. Young',       'Cameron Young',       'USA', 45, 3,  3),
  ((select id from tournaments where year=2026 and theme='masters'), 'F. Couples',     'Fred Couples',        'USA', 99, 2,  2),
  ((select id from tournaments where year=2026 and theme='masters'), 'B. Watson',      'Bubba Watson',        'USA', 99, 2,  2),
  ((select id from tournaments where year=2026 and theme='masters'), 'J. Maggert',     'Jeff Maggert',        'USA', 99, 1,  1);

-- ============================================================
-- GLOBAL LEAGUE (auto-created, all users join automatically)
-- created_by set to 'system' as it's server-created
-- ============================================================
insert into leagues (tournament_id, name, code, created_by, type)
values (
  (select id from tournaments where year=2026 and theme='masters'),
  'Masters 2026 Global',
  'GLOBAL',
  'system',
  'global'
);
