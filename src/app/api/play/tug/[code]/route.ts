import { NextResponse } from 'next/server'
import { getPlayAccount } from '@/lib/playAuth'
import { loadTugState } from '@/lib/playTug'

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const account = await getPlayAccount()
  if (!account) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const { code } = await params
  try {
    const state = await loadTugState(code, account.id, account.role === 'teacher')
    if (!state) return NextResponse.json({ error: 'Game not found.' }, { status: 404 })
    return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('Play tug state failed', err)
    return NextResponse.json({ error: 'Something went wrong loading the game.' }, { status: 500 })
  }
}
