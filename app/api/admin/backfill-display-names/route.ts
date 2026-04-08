// Admin route: backfill display names for specific Clerk users
// POST with x-admin-secret header — updates league_members.display_name

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const ADMIN_SECRET = process.env.ADMIN_SECRET

// Clerk user_id → desired display name (IDs confirmed via Clerk API)
const BACKFILLS: { userId: string; displayName: string }[] = [
  { userId: 'user_3C2lc6c03HY6oyEKHvuQdUb1l6H', displayName: 'Dad' },          // dmiddleton2305@gmail.com
  { userId: 'user_3C2R7UDczhoKe2E0yxzAHJZSNd0', displayName: 'Ian Welsh' },     // ianwelshnufc@yahoo.co.uk
  { userId: 'user_3C25dMSKjGHAC5Ynn7QobjgyB7g', displayName: 'David Middleton' }, // damiddleton23@gmail.com
]

export async function POST(req: Request) {
  if (!ADMIN_SECRET || req.headers.get('x-admin-secret') !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const db = createServiceClient()
  const results: { displayName: string; userId: string; updated: number }[] = []

  for (const { userId, displayName } of BACKFILLS) {
    const { data } = await db
      .from('league_members')
      .update({ display_name: displayName })
      .eq('user_id', userId)
      .select('id')
    results.push({ displayName, userId, updated: data?.length ?? 0 })
  }

  return NextResponse.json({ ok: true, results })
}
