import { randomId } from '@/lib/randomId'
import { supabase } from '@/lib/supabase'
import { checkDescription, checkFile, checkLink, checkTitle, mimeFor, storagePath, toResource, type Resource } from '@/lib/resourcesPure'

// The screen's side of the teacher resource space. Every rule (who can see, share, edit, remove and pin) is enforced by the database
// (migration 087) with the signed-in person's own login; these calls only ask, and report what the database says.

const BUCKET = 'department-resources'

export type MyDepartment = { id: string; name: string; isHead: boolean; canShare: boolean }
type Result = { ok: true } | { ok: false; error: string }
const fail = (e: { message?: string; code?: string } | null, fallback = 'Something went wrong. Please try again.'): { ok: false; error: string } => ({
  ok: false,
  error: e?.code === '42501' ? 'You are not allowed to do that.' : e?.code === 'P0001' && e.message ? e.message : fallback,
})

let availability: Promise<boolean> | null = null
// The resource space needs migration 087. Until it is applied, no link to it is shown.
export function isResourcesAvailable(): Promise<boolean> {
  if (!availability) {
    availability = (async () => {
      try { const { error } = await supabase.rpc('department_resources_ready'); return !error } catch { return false }
    })()
  }
  return availability
}

export async function loadMyDepartments(): Promise<MyDepartment[] | null> {
  try {
    const { data, error } = await supabase.rpc('resources_my_departments')
    if (error || !Array.isArray(data)) return null
    return data.map((d: Record<string, unknown>) => ({ id: String(d.id), name: String(d.name), isHead: d.is_head === true, canShare: d.can_share === true }))
  } catch { return null }
}

export async function loadResources(departmentId: string): Promise<Resource[] | null> {
  try {
    const { data, error } = await supabase.rpc('department_resources_list', { p_dept: departmentId })
    if (error || !Array.isArray(data)) return null
    return data.map((r: Record<string, unknown>) => toResource(r))
  } catch { return null }
}

export type Tags = { subject: string; grade: string; topic: { id: string } | null }
const tagFields = (t: Tags) => ({ subject: t.subject.trim() || null, grade: t.grade ? Number(t.grade) : null, topic_id: t.topic?.id ?? null })

export async function shareLink(departmentId: string, f: { title: string; description: string; url: string } & Tags): Promise<Result> {
  const problem = checkTitle(f.title) || checkDescription(f.description)
  if (problem) return { ok: false, error: problem }
  const link = checkLink(f.url)
  if (!link.ok) return link
  const { error } = await supabase.from('department_resources').insert({ department_id: departmentId, kind: 'link', title: f.title.trim(), description: f.description.trim(), url: link.url, ...tagFields(f) })
  return error ? fail(error) : { ok: true }
}

// Uploads the file first, then saves the item. If saving fails the upload is removed again so nothing is left behind.
export async function shareFile(departmentId: string, file: File, f: { title: string; description: string } & Tags): Promise<Result> {
  const problem = checkTitle(f.title) || checkDescription(f.description) || checkFile({ name: file.name, size: file.size, type: file.type })
  if (problem) return { ok: false, error: problem }
  const id = randomId()
  const path = storagePath(departmentId, id, file.name)
  const { error: upError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: mimeFor(file), upsert: false })
  if (upError) return { ok: false, error: 'The file could not be uploaded. Check your connection and try again.' }
  const { error } = await supabase.from('department_resources').insert({ id, department_id: departmentId, kind: 'file', title: f.title.trim(), description: f.description.trim(), file_path: path, file_name: file.name.slice(0, 200), file_size: file.size, mime_type: mimeFor(file), ...tagFields(f) })
  if (error) { await supabase.storage.from(BUCKET).remove([path]); return fail(error) }
  return { ok: true }
}

export async function updateResource(id: string, f: { title: string; description: string; url?: string } & Tags): Promise<Result> {
  const problem = checkTitle(f.title) || checkDescription(f.description)
  if (problem) return { ok: false, error: problem }
  const patch: Record<string, unknown> = { title: f.title.trim(), description: f.description.trim(), ...tagFields(f) }
  if (f.url !== undefined) { const link = checkLink(f.url); if (!link.ok) return link; patch.url = link.url }
  const { error } = await supabase.from('department_resources').update(patch).eq('id', id)
  return error ? fail(error) : { ok: true }
}

export async function setPinned(id: string, pinned: boolean): Promise<Result> {
  const { error } = await supabase.from('department_resources').update({ pinned }).eq('id', id)
  return error ? fail(error) : { ok: true }
}

// A file's stored copy goes first (the rules need the item to still exist to allow it), then the item.
export async function removeResource(r: Resource): Promise<Result> {
  if (r.kind === 'file' && r.filePath) {
    const { error } = await supabase.storage.from(BUCKET).remove([r.filePath])
    if (error) return { ok: false, error: 'The file could not be removed. Please try again.' }
  }
  const { error } = await supabase.from('department_resources').delete().eq('id', r.id)
  return error ? fail(error) : { ok: true }
}

// Opens a link, or makes a one minute link to a file for this person only and opens that.
export async function openResource(r: Resource): Promise<Result> {
  if (r.kind === 'link' && r.url) { window.open(r.url, '_blank', 'noopener,noreferrer'); return { ok: true } }
  if (r.kind === 'file' && r.filePath) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(r.filePath, 60, { download: r.fileName ?? true })
    if (error || !data?.signedUrl) return { ok: false, error: 'The file could not be opened. Please try again.' }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    return { ok: true }
  }
  return { ok: false, error: 'There is nothing to open.' }
}
