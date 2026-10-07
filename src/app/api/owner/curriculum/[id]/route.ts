import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeOwner, isUuid } from '@/lib/libraryOwner'
import { validateBody } from '@/lib/validateBody'

const patch = z.object({ status: z.enum(['draft', 'published']) }).strict()

// Withdraw a guide from the lesson planner (draft) or put it back (published).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Guide not found.' }, { status: 404 })
    const access = await authorizeOwner(req)
    if (!access.ok) return access.response
    const parsed = await validateBody(req, patch)
    if ('error' in parsed) return parsed.error
    const { data, error } = await access.library.from('curriculum_documents').update({ status: parsed.data.status, updated_at: new Date().toISOString() }).eq('id', id).select('id, status').maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Guide not found.' }, { status: 404 })
    return NextResponse.json({ document: data })
  } catch (err) {
    console.error('owner/curriculum PATCH error:', err)
    return NextResponse.json({ error: 'Could not change that guide.' }, { status: 500 })
  }
}

// Remove a guide and all its pieces.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Guide not found.' }, { status: 404 })
    const access = await authorizeOwner(req)
    if (!access.ok) return access.response
    const { error } = await access.library.from('curriculum_documents').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('owner/curriculum DELETE error:', err)
    return NextResponse.json({ error: 'Could not remove that guide.' }, { status: 500 })
  }
}
