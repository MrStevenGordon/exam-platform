'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { LessonRow } from '@/lib/learning'
import { requestGuideDraft, saveGuide } from '@/lib/lessonGuideClient'

const MAX_PER_RUN = 10

// Drafts study guides for several lessons in one go, as DRAFTS only: nothing becomes visible to students until the teacher opens a
// lesson, reads its guide and switches it on. Practice questions are not added in bulk; the teacher chooses them lesson by lesson.
export default function GuideDraftAll({ lessonIds, onDone }: { lessonIds: string[]; onDone: () => void }) {
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState('')
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  const batch = lessonIds.slice(0, MAX_PER_RUN)
  if (lessonIds.length === 0) return null

  async function run() {
    if (running) return
    setRunning(true); setMessage('')
    let made = 0
    let stopped = ''
    for (let i = 0; i < batch.length; i++) {
      setProgress({ done: i, total: batch.length })
      const { data } = await supabase.from('learning_lessons').select('id, title, subject, grade, topic_id, key_terms, steps, status, lesson_plan_id, updated_at').eq('id', batch[i]).maybeSingle()
      const lesson = data as LessonRow | null
      if (!lesson || !lesson.steps.some((s) => s.text.trim())) continue
      const res = await requestGuideDraft(lesson)
      if (!res.ok) { stopped = res.error; break }
      const saved = await saveGuide(lesson.id, {
        keyPoints: res.draft.keyPoints, canDo: res.draft.canDo, cards: res.draft.cards.map((c) => ({ front: c.front, back: c.back, step: c.step })), on: false, draftedByAi: true,
      })
      if (!saved.ok) { stopped = saved.error; break }
      made++
    }
    setProgress(null); setRunning(false)
    setMessage(`${made} study guide${made === 1 ? '' : 's'} drafted.${stopped ? ` Stopped: ${stopped}` : ''} Open a lesson and its Study guide tab to read it and switch it on.`)
    onDone()
  }

  return (
    <div className="card" style={{ marginBottom: 14, borderColor: 'var(--accent)' }}>
      <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 14 }}>Study guides for your lessons</p>
      <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text-secondary)' }}>
        {lessonIds.length} published lesson{lessonIds.length === 1 ? ' has' : 's have'} no study guide yet. Draft the key points, can-do list and flashcards for {batch.length === lessonIds.length ? 'all of them' : `the next ${batch.length}`}. They stay as drafts: students see nothing until you read each one and switch it on.
      </p>
      <button type="button" className="btn btn-secondary" onClick={run} disabled={running}>
        {running && progress ? `Drafting ${progress.done + 1} of ${progress.total}…` : `✨ Draft ${batch.length} guide${batch.length === 1 ? '' : 's'} with AI`}
      </button>
      {running && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '8px 0 0' }}>About half a minute each. Please stay on this page.</p>}
      {message && <p role="status" style={{ fontSize: 13, margin: '10px 0 0' }}>{message}</p>}
    </div>
  )
}
