// Admin route: backfill display names for specific Clerk users
// POST with x-admin-secret header — updates league_members.display_name
// Hardcoded three accounts: Dave, dmiddleton2305, ianwelshnufc

import { NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/server'

const ADMIN_SECRET = process.env.ADMIN_SECRET

// username → desired display name
const BACKFILLS: Record<string, string> = {
  dmiddleton2305: 'Dad',
  ianwelshnufc: 'Ian Welsh',
}

// email → desired display name (for Dave's account)
const EMAIL_BACKFILLS: Record<string, string> = {
  'dmiddleton23@live.co.uk': 'David Middleton',
}

export async function POST(req: Request) {
  if (!ADMIN_SECRET || req.headers.get('x-admin-secret') !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const db = createServiceClient()
  const clerk = await clerkClient()
  const results: { name: string; userId: string; updated: number }[] = []

  // Look up by username
  for (const [username, displayName] of Object.entries(BACKFILLS)) {
    try {
      const { data: users } = await clerk.users.getUserList({ username: [username], limit: 1 })
      const user = users[0]
      if (!user) {
        results.push({ name: displayName, userId: 'not_found', updated: 0 })
        continue
      }
      const { data: updated } = await db
        .from('league_members')
        .update({ display_name: displayName })
        .eq('user_id', user.id)
        .select('id')
      results.push({ name: displayName, userId: user.id, updated: updated?.length ?? 0 })
    } catch {
      results.push({ name: displayName, userId: 'error', updated: 0 })
    }
  }

  // Look up by email
  for (const [email, displayName] of Object.entries(EMAIL_BACKFILLS)) {
    try {
      const { data: users } = await clerk.users.getUserList({ emailAddress: [email], limit: 1 })
      const user = users[0]
      if (!user) {
        results.push({ name: displayName, userId: 'not_found', updated: 0 })
        continue
      }
      const { data: updated2 } = await db
        .from('league_members')
        .update({ display_name: displayName })
        .eq('user_id', user.id)
        .select('id')
      results.push({ name: displayName, userId: user.id, updated: updated2?.length ?? 0 })
    } catch {
      results.push({ name: displayName, userId: 'error', updated: 0 })
    }
  }

  return NextResponse.json({ ok: true, results })
}
