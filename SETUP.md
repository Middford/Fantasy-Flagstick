# Fantasy Flagstick — Setup Guide

Masters Round 1: **Thursday 10 April 2026, 14:00 BST**

---

## Blockers Requiring User Action

### 1. Clerk — Auth Provider

**Clerk Dashboard:** https://dashboard.clerk.com

1. Create a new application called "Fantasy Flagstick"
2. Enable sign-in methods: Email + Google OAuth
3. Go to **API Keys** and copy:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
4. Set redirect URLs in Clerk:
   - Allowed redirect: `https://yourdomain.vercel.app/`
   - Sign-in URL: `/sign-in`
   - Sign-up URL: `/sign-up`
5. Set up Supabase JWT template (see Supabase README)

### 2. Supabase — Database

See `supabase/README.md` for full instructions.

Quick steps:
1. Create project at https://supabase.com
2. SQL Editor → run `supabase/schema.sql`
3. SQL Editor → run `supabase/seed.sql`
4. Settings → API → copy URL + anon key + service role key
5. Configure Clerk JWT template with Supabase JWT secret

### 3. Vercel — Hosting

1. Go to https://vercel.com
2. Import GitHub repo `Middford/Fantasy-Flagstick`
3. Add all environment variables from `.env.example`:
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
   CLERK_SECRET_KEY=
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   DATAGOLF_API_KEY=2a5d79526f5919aaeb2e06a1f797
   NEXT_PUBLIC_APP_URL=https://yourdomain.vercel.app
   CRON_SECRET=<generate a random string>
   ```
4. Deploy
5. Vercel Cron (vercel.json already configured) — enable in Vercel dashboard under Cron Jobs
6. Update Clerk allowed redirect URLs to your Vercel domain

### 4. Hole Images

Place 18 hole images in `/public/holes/`:
- `hole-01.jpg` through `hole-18.jpg`
- Augusta National illustrated hole diagrams
- If not available, app falls back to green gradient placeholder

### 5. PWA Icons

Place in `/public/`:
- `icon-192.png` (192×192 Masters-themed icon)
- `icon-512.png` (512×512 Masters-themed icon)

---

## Environment Variables Reference

```env
# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# DataGolf (subscribed — cancel within 30 days of Masters ending)
DATAGOLF_API_KEY=2a5d79526f5919aaeb2e06a1f797

# App
NEXT_PUBLIC_APP_URL=https://fantasyflagstick.com
CRON_SECRET=<random-string>
```

---

## Local Development

```bash
npm install
cp .env.example .env.local
# Fill in .env.local with your keys
npm run dev
```

App runs on http://localhost:3000

---

## DataGolf Subscription

- Subscribe: Day before Masters (April 9)
- Cancel: Within 30 days (before May 9)
- Cost: $22.50/month
- Used for: pre-tournament pricing, Beat the Bookie
- Cancel at: https://datagolf.com/account

---

## Architecture Notes

- **Auth**: Clerk handles all authentication. User IDs are `text` in the format `user_xxx`
- **DB**: Supabase PostgreSQL with Row Level Security using Clerk JWTs
- **Live scores**: ESPN public API polled every 60 seconds via Vercel Cron (free, no key)
- **DataGolf**: Used for pre-round pricing (once) and Beat the Bookie updates (every 5 mins)
- **Realtime**: Supabase Realtime broadcasts price changes and lock events to all clients
- **Pro Mode**: DB columns exist (age_verified, pro_mode_enabled) but feature NOT built
