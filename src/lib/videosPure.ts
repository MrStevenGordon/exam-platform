// Videos in Smart Learning: teachers and heads of department add links to videos that live elsewhere (YouTube, Vimeo, Khan Academy). The school hosts
// nothing. Only these three sites are accepted, and only YouTube and Vimeo are played inside the page. The database (migration 093) re-checks every
// link with the same rules, so a link that passes here is accepted there and the other way round (scripts/tests/videos/links.json tests both).

export type Provider = 'youtube' | 'vimeo' | 'khan'
export type ParsedLink = { provider: Provider; id: string; url: string }
export const LINK_HELP = 'Paste a YouTube, Vimeo or Khan Academy link.'

const YT_ID = '[A-Za-z0-9_-]{11}'

export function parseVideoLink(input: string): ParsedLink | null {
  const raw = (input ?? '').trim()
  if (!raw || raw.length > 500) return null
  let m = raw.match(new RegExp(`^https?://(?:www\\.|m\\.)?(?:youtube\\.com|youtube-nocookie\\.com)/(?:watch\\?(?:[^#\\s]*&)?v=|shorts/|embed/|live/)(${YT_ID})(?![A-Za-z0-9_-])`, 'i'))
    ?? raw.match(new RegExp(`^https?://youtu\\.be/(${YT_ID})(?![A-Za-z0-9_-])`, 'i'))
  if (m) return { provider: 'youtube', id: m[1], url: `https://www.youtube.com/watch?v=${m[1]}` }
  m = raw.match(/^https?:\/\/(?:www\.|player\.)?vimeo\.com\/(?:video\/)?(\d{3,12})(?![0-9])/i)
  if (m) return { provider: 'vimeo', id: m[1], url: `https://vimeo.com/${m[1]}` }
  m = raw.match(/^https?:\/\/(?:www\.)?khanacademy\.org\/([^\s?#]+)/i)
  if (m) return { provider: 'khan', id: '', url: `https://www.khanacademy.org/${m[1]}` }
  return null
}

// What to put in an iframe, or null when the site is opened in a new tab instead. Built from the checked id, never from the pasted text.
export function embedUrl(v: { provider: Provider; external_id: string }): string | null {
  if (v.provider === 'youtube' && /^[A-Za-z0-9_-]{11}$/.test(v.external_id)) return `https://www.youtube-nocookie.com/embed/${v.external_id}?rel=0&playsinline=1&modestbranding=1&autoplay=1`
  if (v.provider === 'vimeo' && /^\d{3,12}$/.test(v.external_id)) return `https://player.vimeo.com/video/${v.external_id}?autoplay=1&dnt=1`
  return null
}
export const thumbnailUrl = (v: { provider: Provider; external_id: string }): string | null =>
  v.provider === 'youtube' && /^[A-Za-z0-9_-]{11}$/.test(v.external_id) ? `https://i.ytimg.com/vi/${v.external_id}/hqdefault.jpg` : null
export const PROVIDER_LABEL: Record<Provider, string> = { youtube: 'YouTube', vimeo: 'Vimeo', khan: 'Khan Academy' }

export type VideoStatus = 'pending' | 'approved' | 'hidden' | 'removed'
export type Video = {
  id: string; provider: Provider; external_id: string; url: string; title: string; note: string | null; subject: string
  topic_id: string | null; topic: string | null; grade_from: number | null; grade_to: number | null
  added_by: string; added_by_name: string; status: VideoStatus; created_at: string
  reports: number; can_edit: boolean; can_manage: boolean
}

export const STATUS_LABEL: Record<VideoStatus, string> = { pending: 'Waiting for approval', approved: 'Approved', hidden: 'Hidden', removed: 'Removed' }

// Grades a video is for: "All grades", "Grade 9", "Grades 7 to 9", "Grade 9 and up", "Up to Grade 9".
export function gradeLabel(from: number | null, to: number | null): string {
  if (from === null && to === null) return 'All grades'
  if (from !== null && to !== null) return from === to ? `Grade ${from}` : `Grades ${from} to ${to}`
  return from !== null ? `Grade ${from} and up` : `Up to Grade ${to}`
}
export const forGrade = (v: Pick<Video, 'grade_from' | 'grade_to'>, grade: number | null): boolean =>
  grade === null || ((v.grade_from === null || grade >= v.grade_from) && (v.grade_to === null || grade <= v.grade_to))

export function subjectsOf(videos: Pick<Video, 'subject'>[]): string[] {
  const seen = new Map<string, string>()
  for (const v of videos) { const k = v.subject.trim().toLowerCase(); if (!seen.has(k)) seen.set(k, v.subject.trim()) }
  return [...seen.values()].sort((a, b) => a.localeCompare(b))
}
export const bySubject = <T extends Pick<Video, 'subject'>>(videos: T[], subject: string): T[] =>
  !subject ? videos : videos.filter((v) => v.subject.trim().toLowerCase() === subject.trim().toLowerCase())

export type Split = { pending: Video[]; approved: Video[]; hidden: Video[]; mine: Video[] }
// Staff view: what is waiting for a decision (that this person may decide), what is live, what students reported, and what this person added.
export function splitForStaff(videos: Video[], me: string): Split {
  return {
    pending: videos.filter((v) => v.status === 'pending' && v.can_manage),
    hidden: videos.filter((v) => v.status === 'hidden' && v.can_manage),
    approved: videos.filter((v) => v.status === 'approved'),
    mine: videos.filter((v) => v.added_by === me),
  }
}

// Low-data mode: on by default for a phone saving data or on a slow connection, otherwise off, and the person's own choice always wins.
export function defaultLowData(conn: { saveData?: boolean; effectiveType?: string } | undefined | null): boolean {
  if (!conn) return false
  return !!conn.saveData || ['slow-2g', '2g', '3g'].includes(conn.effectiveType ?? '')
}
export const DATA_NOTE = 'Low-data mode: no pictures, and a video only loads when you tap Play.'
