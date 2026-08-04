import { NextResponse } from 'next/server'
import { z } from 'zod'

// Parses and validates a request body against a zod schema. Schemas should
// use .strict() so unexpected fields are rejected, not silently dropped.
export async function validateBody<T extends z.ZodTypeAny>(
  req: Request,
  schema: T
): Promise<{ data: z.infer<T> } | { error: NextResponse }> {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return { error: NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }) }
  }

  const result = schema.safeParse(json)
  if (!result.success) {
    const first = result.error.issues[0]
    const message = first ? `${first.path.join('.') || 'request'}: ${first.message}` : 'Invalid request.'
    return { error: NextResponse.json({ error: message }, { status: 400 }) }
  }

  return { data: result.data }
}
