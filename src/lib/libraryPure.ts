// Small pure helpers for the Library, kept free of imports so they can be tested on their own.

// "Read" for a PDF, "listen" for audio. A title may have both.
export function formatsOf(files: Array<{ kind: string }>): Array<'read' | 'listen'> {
  const out: Array<'read' | 'listen'> = []
  if (files.some((f) => f.kind === 'pdf')) out.push('read')
  if (files.some((f) => f.kind === 'audio')) out.push('listen')
  return out
}

// A search term that is safe to drop into a PostgREST or() filter: letters, numbers, spaces, apostrophes and hyphens only.
export function cleanSearch(q: string | null | undefined): string {
  return (q || '').replace(/[^\p{L}\p{N} '\-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)
}

const PDF_TYPES = ['application/pdf']
const AUDIO_EXT: Record<string, string> = { 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/x-wav': 'wav' }

// The storage extension for a file, or null when the type is not one the Library accepts for that kind.
export function extensionFor(kind: 'pdf' | 'audio', contentType: string): string | null {
  const type = contentType.toLowerCase().split(';')[0].trim()
  if (kind === 'pdf') return PDF_TYPES.includes(type) ? 'pdf' : null
  return AUDIO_EXT[type] ?? null
}

export const readPercent = (page: number, pages: number) => (pages > 0 ? Math.round((page / pages) * 100) : 0)

// Overall progress through an audio book made of chapters: by time when every chapter's length is known, otherwise by chapter.
export function listenPercent(files: Array<{ duration_seconds: number | null }>, index: number, seconds: number, currentDuration: number): number {
  if (files.length === 0) return 0
  const known = files.every((f) => (f.duration_seconds ?? 0) > 0)
  if (known) {
    const total = files.reduce((sum, f) => sum + (f.duration_seconds as number), 0)
    const before = files.slice(0, index).reduce((sum, f) => sum + (f.duration_seconds as number), 0)
    return total > 0 ? ((before + seconds) / total) * 100 : 0
  }
  const within = currentDuration > 0 ? seconds / currentDuration : 0
  return ((index + within) / files.length) * 100
}

export function formatDuration(totalSeconds: number | null | undefined): string {
  const s = Math.max(0, Math.floor(totalSeconds ?? 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`
}
