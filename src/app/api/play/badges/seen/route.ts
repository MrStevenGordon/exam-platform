import { NextResponse } from 'next/server'
import { getPlayAccountId } from '@/lib/playAuth'
import { markBadgesSeen } from '@/lib/playBadges'

// Clears the "new" marker once the student has looked at their badges.
export async function POST() {
  const accountId = await getPlayAccountId()
  if (!accountId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  try {
    await markBadgesSeen(accountId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Play badges seen failed', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
