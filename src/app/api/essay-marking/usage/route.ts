import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateBody } from '@/lib/validateBody'
import { authorizeMarker, usageOf, usedThisMonth } from '@/lib/essayMarkingServer'

const schema = z.object({ accessToken: z.string().min(1).max(4000) }).strict()

// How many AI suggestions this teacher has used this month, and whether their school has the feature on.
export async function POST(req: NextRequest) {
  try {
    const parsed = await validateBody(req, schema)
    if ('error' in parsed) return parsed.error
    const who = await authorizeMarker(parsed.data.accessToken)
    if (!who.ok) return who.response
    return NextResponse.json({ enabled: true, usage: usageOf(await usedThisMonth(who.caller.userId)) })
  } catch (err) {
    console.error('essay-marking usage error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
