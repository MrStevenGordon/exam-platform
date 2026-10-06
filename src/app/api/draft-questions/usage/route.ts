import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateBody } from '@/lib/validateBody'
import { authorizeDrafter, usageOf, usedThisMonth } from '@/lib/questionDraftServer'

const schema = z.object({ accessToken: z.string().min(1).max(4000) }).strict()

// How many AI question drafts the signed-in teacher has left this month.
export async function POST(req: NextRequest) {
  try {
    const parsed = await validateBody(req, schema)
    if ('error' in parsed) return parsed.error
    const who = await authorizeDrafter(parsed.data.accessToken)
    if (!who.ok) return who.response
    return NextResponse.json({ usage: usageOf(await usedThisMonth(who.userId)) })
  } catch (err) {
    console.error('draft-questions usage error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
