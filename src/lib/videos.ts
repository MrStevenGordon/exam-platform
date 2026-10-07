import { supabase } from '@/lib/supabase'
import type { Video } from '@/lib/videosPure'

// The Videos screens' side. The database (migration 093) decides what each person sees and may do; every call here just uses the signed-in
// person's own session.

let availability: Promise<boolean> | null = null

// Videos need migration 093. Until it is applied, no Videos link is shown.
export function isVideosAvailable(): Promise<boolean> {
  if (!availability) {
    availability = (async () => {
      try {
        const { error } = await supabase.rpc('videos_ready')
        return !error
      } catch {
        return false
      }
    })()
  }
  return availability
}

type Failure = { ok: false; error: string }
const fail = (e: { message?: string } | null): Failure => ({ ok: false, error: e?.message || 'Something went wrong. Please try again.' })

export async function loadVideos(): Promise<{ ok: true; videos: Video[] } | Failure> {
  const { data, error } = await supabase.rpc('videos_list')
  if (error) return fail(error)
  return { ok: true, videos: (data || []) as Video[] }
}

export type VideoFields = { title: string; note: string; subject: string; topicId: string | null; gradeFrom: number | null; gradeTo: number | null }

export async function addVideo(url: string, f: VideoFields): Promise<{ ok: true; id: string } | Failure> {
  const { data, error } = await supabase.rpc('video_add', { p_url: url, p_title: f.title, p_note: f.note || null, p_subject: f.subject, p_topic: f.topicId, p_grade_from: f.gradeFrom, p_grade_to: f.gradeTo })
  return error ? fail(error) : { ok: true, id: data as string }
}

export async function updateVideo(id: string, f: VideoFields): Promise<{ ok: true } | Failure> {
  const { error } = await supabase.rpc('video_update', { p_id: id, p_title: f.title, p_note: f.note || null, p_subject: f.subject, p_topic: f.topicId, p_grade_from: f.gradeFrom, p_grade_to: f.gradeTo })
  return error ? fail(error) : { ok: true }
}

export async function setVideoStatus(id: string, status: 'approved' | 'hidden' | 'removed'): Promise<{ ok: true } | Failure> {
  const { error } = await supabase.rpc('video_set_status', { p_id: id, p_status: status })
  return error ? fail(error) : { ok: true }
}

export async function removeVideo(id: string): Promise<{ ok: true } | Failure> {
  const { error } = await supabase.rpc('video_remove', { p_id: id })
  return error ? fail(error) : { ok: true }
}

export async function reportVideo(id: string, reason: string): Promise<{ ok: true } | Failure> {
  const { error } = await supabase.rpc('video_report', { p_id: id, p_reason: reason || null })
  return error ? fail(error) : { ok: true }
}

// The person's own low-data choice, remembered on this device (the page works without it).
const LOW_KEY = 'sa-low-data'
export function readLowData(): boolean | null {
  try { const v = window.localStorage.getItem(LOW_KEY); return v === '1' ? true : v === '0' ? false : null } catch { return null }
}
export function saveLowData(on: boolean): void {
  try { window.localStorage.setItem(LOW_KEY, on ? '1' : '0') } catch { /* private window: the choice just is not remembered */ }
}
