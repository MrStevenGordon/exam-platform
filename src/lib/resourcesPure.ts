// The teacher resource space: checking what a teacher types, naming files safely, and finding things on the shelf. No network, no database,
// no screen, so every rule can be tested (scripts/tests/resources/resourcesPure.test.mjs). The database enforces the same limits.

export type Resource = {
  id: string
  title: string
  description: string
  kind: 'link' | 'file'
  url: string | null
  filePath: string | null
  fileName: string | null
  fileSize: number | null
  subject: string | null
  grade: number | null
  topicId: string | null
  topicName: string | null
  pinned: boolean
  createdAt: string
  sharedBy: string
  mine: boolean
  canEdit: boolean
  canRemove: boolean
  canPin: boolean
}

export const LIMITS = { title: 150, description: 1000, link: 2000, subject: 100, fileBytes: 20 * 1024 * 1024 } as const

// What a department may share as a file: documents and pictures. The bucket has the same list.
export const FILE_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  txt: 'text/plain',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}
export const ACCEPT = Object.keys(FILE_TYPES).map((e) => '.' + e).join(',')
const ALLOWED_MIMES = new Set(Object.values(FILE_TYPES))

export const extensionOf = (name: string): string => (/\.([A-Za-z0-9]{1,5})$/.exec(name.trim())?.[1] ?? '').toLowerCase()

export function checkTitle(raw: string): string | null {
  const t = raw.trim()
  if (!t) return 'Give the resource a title.'
  if (t.length > LIMITS.title) return `Keep the title under ${LIMITS.title} characters.`
  return null
}
export const checkDescription = (raw: string): string | null => (raw.length > LIMITS.description ? `Keep the description under ${LIMITS.description} characters.` : null)

export type LinkCheck = { ok: true; url: string } | { ok: false; error: string }
// Links must be https, with a real address, no spaces and no sign-in details tucked in the address.
export function checkLink(raw: string): LinkCheck {
  const v = raw.trim()
  if (!v) return { ok: false, error: 'Paste the link.' }
  if (/\s/.test(v)) return { ok: false, error: 'A link cannot contain spaces.' }
  if (v.length > LIMITS.link) return { ok: false, error: 'That link is too long.' }
  if (!/^https:\/\//i.test(v)) return { ok: false, error: 'The link must start with https:// (a secure address).' }
  let u: URL
  try { u = new URL(v) } catch { return { ok: false, error: 'That does not look like a web address.' } }
  if (!u.hostname.includes('.')) return { ok: false, error: 'That does not look like a web address.' }
  if (u.username || u.password) return { ok: false, error: 'Remove the user name or password from the link.' }
  return { ok: true, url: v }
}

// null when fine, otherwise a sentence. The type comes from the browser, with the file's ending as a fallback for browsers that leave it blank.
export function checkFile(f: { name: string; size: number; type: string }): string | null {
  if (!f.name.trim()) return 'That file has no name.'
  if (!(f.size > 0)) return 'That file is empty.'
  if (f.size > LIMITS.fileBytes) return `That file is ${formatSize(f.size)}. The most is ${formatSize(LIMITS.fileBytes)}.`
  const ext = extensionOf(f.name)
  const mimeOk = f.type ? ALLOWED_MIMES.has(f.type) : false
  if (!(ext in FILE_TYPES) && !mimeOk) return 'That type of file is not allowed. Use a PDF, Word, PowerPoint, Excel, CSV, text file or a picture.'
  if (ext in FILE_TYPES && f.type && !ALLOWED_MIMES.has(f.type) && f.type !== 'application/octet-stream') return 'That file is not what its ending says. Use a PDF, Word, PowerPoint, Excel, CSV, text file or a picture.'
  return null
}

// The type to store the file as: the browser's if it is one we allow, otherwise from the ending.
export function mimeFor(f: { name: string; type: string }): string {
  if (ALLOWED_MIMES.has(f.type)) return f.type
  return FILE_TYPES[extensionOf(f.name)] ?? 'application/octet-stream'
}

// A readable but safe file name: no folders, no odd characters, same ending, not too long.
export function safeFileName(name: string): string {
  const ext = extensionOf(name)
  const base = name.trim().replace(/\.[A-Za-z0-9]{1,5}$/, '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-{2,}/g, '-').replace(/^[-.]+|[-.]+$/g, '').slice(0, 80)
  return (base || 'file') + (ext ? '.' + ext : '')
}

// Where a file lives: its own department first, so the storage rules can check membership from the path.
export const storagePath = (departmentId: string, resourceId: string, fileName: string): string => `${departmentId}/${resourceId}-${safeFileName(fileName)}`

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`
}

export const domainOf = (url: string): string => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' } }

export function toResource(r: Record<string, unknown>): Resource {
  const s = (v: unknown) => (typeof v === 'string' ? v : null)
  return {
    id: String(r.id), title: s(r.title) ?? '', description: s(r.description) ?? '', kind: r.kind === 'file' ? 'file' : 'link', url: s(r.url), filePath: s(r.file_path),
    fileName: s(r.file_name), fileSize: typeof r.file_size === 'number' ? r.file_size : null, subject: s(r.subject), grade: typeof r.grade === 'number' ? r.grade : null,
    topicId: s(r.topic_id), topicName: s(r.topic_name), pinned: r.pinned === true, createdAt: s(r.created_at) ?? '', sharedBy: s(r.shared_by) ?? 'A colleague',
    mine: r.mine === true, canEdit: r.can_edit === true, canRemove: r.can_remove === true, canPin: r.can_pin === true,
  }
}

export type Filters = { search: string; subject: string; grade: string; kind: '' | 'link' | 'file' }
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

// Pinned first, then newest. Every word typed in the search must appear somewhere in the title, description, subject, topic or sharer's name.
export function filterResources(list: Resource[], f: Filters): Resource[] {
  const words = norm(f.search).split(' ').filter(Boolean)
  return list
    .filter((r) => (!f.subject || norm(r.subject ?? '') === norm(f.subject)) && (!f.grade || String(r.grade ?? '') === f.grade) && (!f.kind || r.kind === f.kind))
    .filter((r) => { const hay = norm(`${r.title} ${r.description} ${r.subject ?? ''} ${r.topicName ?? ''} ${r.sharedBy} ${r.fileName ?? ''}`); return words.every((w) => hay.includes(w)) })
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
}

export function facets(list: Resource[]): { subjects: string[]; grades: number[] } {
  const subjects = [...new Map(list.filter((r) => r.subject).map((r) => [norm(r.subject as string), (r.subject as string).trim()])).values()].sort((a, b) => a.localeCompare(b))
  const grades = [...new Set(list.map((r) => r.grade).filter((g): g is number => g !== null))].sort((a, b) => a - b)
  return { subjects, grades }
}
