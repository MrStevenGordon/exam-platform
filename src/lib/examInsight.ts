import { supabase } from '@/lib/supabase'
import type { InsightPayload } from '@/lib/examInsightPure'

// Loads the Insight document for one test or exam. It is fetched with the signed-in person's own login, so the database
// decides what they may see (migration 080); nothing here widens access.

export type InsightLoad =
  | { ok: true; data: InsightPayload }
  | { ok: false; reason: 'not_installed' | 'not_allowed' | 'not_found' | 'failed' }

let availability: Promise<boolean> | null = null

// The Insight page needs migration 080. Until it is applied, no Insight button is shown anywhere.
export function isExamInsightAvailable(): Promise<boolean> {
  if (!availability) {
    availability = (async () => {
      try {
        const { error } = await supabase.rpc('exam_insight_ready')
        return !error
      } catch {
        return false
      }
    })()
  }
  return availability
}

export async function loadExamInsight(kind: 'direct' | 'final', examId: string): Promise<InsightLoad> {
  try {
    const { data, error } = await supabase.rpc('exam_insight_data', { p_kind: kind, p_exam_id: examId })
    if (error) {
      if (error.code === 'PGRST202' || error.code === '42883') return { ok: false, reason: 'not_installed' }
      if (error.code === '42501') return { ok: false, reason: 'not_allowed' }
      if (error.code === 'P0002') return { ok: false, reason: 'not_found' }
      console.error('exam insight load failed:', error)
      return { ok: false, reason: 'failed' }
    }
    return { ok: true, data: data as InsightPayload }
  } catch (err) {
    console.error('exam insight load threw:', err)
    return { ok: false, reason: 'failed' }
  }
}

export type InsightListItem = { kind: 'direct' | 'final'; id: string; title: string; subject: string; exam_kind: string | null; date: string | null; sat: number; classes: string }
export type InsightListLoad = { ok: true; items: InsightListItem[] } | { ok: false; reason: 'not_installed' | 'not_allowed' | 'failed' }

// The tests and exams this person may open Insight for (finished papers only, newest first).
export async function loadExamInsightList(): Promise<InsightListLoad> {
  try {
    const { data, error } = await supabase.rpc('exam_insight_list')
    if (error) {
      if (error.code === 'PGRST202' || error.code === '42883') return { ok: false, reason: 'not_installed' }
      if (error.code === '42501') return { ok: false, reason: 'not_allowed' }
      console.error('exam insight list failed:', error)
      return { ok: false, reason: 'failed' }
    }
    return { ok: true, items: (data ?? []) as InsightListItem[] }
  } catch (err) {
    console.error('exam insight list threw:', err)
    return { ok: false, reason: 'failed' }
  }
}
