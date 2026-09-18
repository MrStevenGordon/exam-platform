import { NextResponse } from 'next/server'
import { getPlayAccountId } from '@/lib/playAuth'
import { CATEGORY_LABELS, loadBadges } from '@/lib/playBadges'

// The signed-in student's badges. Anything newly earned is saved first, so
// looking at this list is also what awards it.
export async function GET() {
  const accountId = await getPlayAccountId()
  if (!accountId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  try {
    const { earned, locked, newCount } = await loadBadges(accountId)
    return NextResponse.json({ earned, locked, newCount, total: earned.length + locked.length, categories: CATEGORY_LABELS })
  } catch (err) {
    console.error('Play badges failed', err)
    return NextResponse.json({ error: 'Something went wrong loading your badges.' }, { status: 500 })
  }
}
