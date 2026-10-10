'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import EmptyState from '@/components/EmptyState'
import type { LessonStatus } from '@/lib/learning'
import { isTutorAvailable } from '@/lib/tutorClient'
import GuideDraftAll from '@/components/learning/GuideDraftAll'
import { isGuidesAvailable } from '@/lib/lessonGuideClient'

type Row = { id: string; title: string; subject: string; grade: number | null; status: LessonStatus; updated_at: string }
type Stats = { lesson_id: string; assigned_students: number; started: number; completed: number }

// A teacher's (or HOD's) lessons: drafts and published, and how each is going.
export default function TeacherLessonList() {
  const [rows, setRows] = useState<Row[]>([])
  const [stats, setStats] = useState<Record<string, Stats>>({})
  // Lessons with tutor conversations flagged for an adult to read (empty if the tutor is not installed).
  const [toReview, setToReview] = useState<Record<string, number>>({})
  // Study guides (migration 100): which lessons have one, and whether it is on.
  const [guides, setGuides] = useState<Record<string, 'draft' | 'on'> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [lessonRes, statRes] = await Promise.all([
        supabase.from('learning_lessons').select('id, title, subject, grade, status, updated_at').neq('status', 'archived').order('updated_at', { ascending: false }),
        supabase.rpc('learning_lesson_stats'),
      ])
      // Only asked when the school has the tutor on and migration 064 is applied.
      const flagRes = (await isTutorAvailable()) ? await supabase.rpc('learning_tutor_flag_counts') : null
      let guideMap: Record<string, 'draft' | 'on'> | null = null
      if (await isGuidesAvailable()) {
        const { data: g } = await supabase.from('learning_lesson_guides').select('lesson_id, status')
        guideMap = Object.fromEntries(((g || []) as { lesson_id: string; status: 'draft' | 'on' }[]).map((x) => [x.lesson_id, x.status]))
      }
      if (cancelled) return
      if (lessonRes.error) setError('Could not load your lessons. Please try again.')
      else setRows((lessonRes.data as Row[]) || [])
      setGuides(guideMap)
      setStats(Object.fromEntries(((statRes.data || []) as Stats[]).map((s) => [s.lesson_id, s])))
      if (flagRes && !flagRes.error) setToReview(Object.fromEntries(((flagRes.data || []) as { lesson_id: string; to_review: number }[]).map((f) => [f.lesson_id, f.to_review])))
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [reload])

  if (loading) return <div>Loading…</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <p className="portal-page-title" style={{ margin: 0 }}>My lessons</p>
        <Link href="/learning/lessons/new" className="btn btn-primary">+ New lesson</Link>
      </div>
      {error && <p className="banner banner-danger" role="alert">{error}</p>}
      {guides && <GuideDraftAll lessonIds={rows.filter((r) => r.status === 'published' && !guides[r.id]).map((r) => r.id)} onDone={() => setReload((n) => n + 1)} />}
      {!error && rows.length === 0 && (
        <EmptyState icon="📚" title="Make your first student lesson" description="Turn a lesson from one of your lesson plans into a page your students can work through, then give it to a class." action={{ label: '+ New lesson', href: '/learning/lessons/new' }} />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((r) => {
          const s = stats[r.id]
          return (
            <Link key={r.id} href={`/learning/lessons/${r.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="card card-clickable" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{r.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{r.subject}{r.grade ? ` · Grade ${r.grade}` : ''}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {toReview[r.id] > 0 && <span className="badge badge-danger" style={{ marginRight: 6 }}>{toReview[r.id]} chat{toReview[r.id] === 1 ? '' : 's'} to read</span>}
                  {guides?.[r.id] && <span className={`badge ${guides[r.id] === 'on' ? 'badge-success' : 'badge-default'}`} style={{ marginRight: 6 }}>{guides[r.id] === 'on' ? 'Guide on' : 'Guide draft'}</span>}
                  <span className={`badge ${r.status === 'published' ? 'badge-success' : 'badge-default'}`}>{r.status === 'published' ? 'Published' : 'Draft'}</span>
                  {s && s.assigned_students > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{s.completed} of {s.assigned_students} finished · {s.started} started</div>
                  )}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
