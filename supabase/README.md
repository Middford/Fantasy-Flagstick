# Fantasy Flagstick — Supabase Setup

## 1. Create a Supabase project

1. Go to https://supabase.com and sign in
2. Click "New project"
3. Name: `fantasy-flagstick`
4. Set a strong database password (save it)
5. Region: Europe West (closest to your users)
6. Wait ~2 minutes for provisioning

## 2. Get your API keys

In Supabase dashboard → Settings → API:

- `NEXT_PUBLIC_SUPABASE_URL` — Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` — service_role key (keep secret)

Add these to `.env.local` in the project root.

## 3. Execute schema

In Supabase dashboard → SQL Editor:

1. Click "New query"
2. Paste the contents of `supabase/schema.sql`
3. Click "Run" — should complete with no errors

## 4. Insert seed data

In SQL Editor, run a new query:

1. Paste contents of `supabase/seed.sql`
2. Click "Run"

Verify in Table Editor that `tournaments`, `holes`, `players`, and `leagues` all have rows.

## 5. Enable Realtime

The schema already runs `alter publication supabase_realtime add table ...` but verify:

1. Supabase dashboard → Database → Replication
2. Confirm `hole_scores`, `players`, `picks`, `beat_the_bookie` are listed

## 6. Configure Clerk JWT with Supabase

This app uses Clerk for auth. Supabase uses Clerk's JWT to identify users.

1. In Clerk Dashboard → JWT Templates → New template
2. Name: `supabase`
3. Template (replace `{YOUR_SUPABASE_JWT_SECRET}` with your Supabase JWT secret):
   ```json
   {
     "iss": "https://clerk.YOUR_DOMAIN.clerk.accounts.dev",
     "sub": "{{user.id}}",
     "aud": "authenticated",
     "role": "authenticated"
   }
   ```
4. Signing key: Use your Supabase project's JWT secret (Settings → API → JWT Settings)
5. In Supabase → Settings → API → JWT Settings: copy the "JWT Secret"
6. In Clerk template, set the signing algorithm to HS256 and paste the secret

## 7. Enable Row Level Security

RLS is enabled in the schema. The `requesting_user_id()` function reads the `sub` claim from the Clerk JWT, which contains the Clerk user ID (e.g. `user_xxx`).

## 8. Historical data pull (optional, do before Masters)

Once DataGolf API key is active, run `scripts/pull-historical-data.ts` to pull Augusta hole averages. This enriches hole stats for the pricing algorithm.

## Notes

- The `created_by = 'system'` in the global league seed is intentional — it's created server-side
- Clerk user IDs are stored as `text` in all user-referencing columns (not uuid)
- RLS policies use `requesting_user_id()` which reads Clerk's JWT `sub` claim
