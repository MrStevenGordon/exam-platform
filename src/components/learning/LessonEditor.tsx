'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import TabHub from '@/components/TabHub'
import LessonBuildTab from '@/components/learning/LessonBuildTab'
import LessonAssignTab from '@/components/learning/LessonAssignTab'
import LessonResultsTab from '@/components/learning/LessonResultsTab'
import LessonChecksTab from '@/components/learning/LessonChecksTab'
import LessonCheckResults from '@/components/learning/LessonCheckResults'
import LessonCatchupTab from '@/components/learning/LessonCatchupTab'
import { isChecksAvailable } from '@/lib/learningChecks'
import { isCatchupAvailable } from '@/lib/learningCatchup'
import LessonTutorTab from '@/components/learning/LessonTutorTab'
import { isTutorAvailable } from '@/lib/tutorClient'
import type { LessonRow } from '@/lib/learning'
import { useRouter, usePathname } from 'next/navigation'

// The teacher's page for one lesson: Build it, give it to classes, see the results.
export default function LessonEditor({ lessonId }: { lessonId: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [lesson, setLesson] = useState<LessonRow | null>(null)
  const [missing, setMissing] = useState(false)
  const [reload, setReload] = useState(0)
  // Check questions need migration 060; until then the tab is not offered.
  const [checksOn, setChecksOn] = useState(false)
  useEffect(() => { isChecksAvailable().then(setChecksOn) }, [])
  // Catch-up needs migration 062.
  const [catchupOn, setCatchupOn] = useState(false)
  useEffect(() => { isCatchupAvailable().then(setCatchupOn) }, [])
  // The tutor tab appears only when the school has the AI tutor on and migration 064 is applied.
  const [tutorOn, setTutorOn] = useState(false)
  useEffect(() => { isTutorAvailable().then(setTutorOn) }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data } = await supabase.from('learning_lessons').select('id, title, subject, grade, topic_id, key_terms, steps, status, lesson_plan_id, updated_at').eq('id', lessonId).maybeSingle()
      if (cancelled) return
      if (!data) setMissing(true)
      else setLesson(data as LessonRow)
    }
    load()
    return () => { cancelled = true }
  }, [lessonId, reload])

  const refresh = useCallback(() => setReload((n) => n + 1), [])
  const goTab = useCallback((tab: string) => router.replace(`${pathname}?tab=${tab}`, { scroll: false }), [router, pathname])

  if (missing) {
    return (
      <div>
        <p className="banner banner-danger" role="alert">That lesson could not be found.</p>
        <Link href="/learning" className="btn btn-secondary">Back to my lessons</Link>
      </div>
    )
  }
  if (!lesson) return <div>Loading…</div>

  return (
    <div>
      <Link href="/learning" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>&larr; My lessons</Link>
      <div style={{ margin: '8px 0 4px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className={`badge ${lesson.status === 'published' ? 'badge-success' : 'badge-default'}`}>{lesson.status === 'published' ? 'Published' : 'Draft'}</span>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{lesson.subject}{lesson.grade ? ` · Grade ${lesson.grade}` : ''}</span>
      </div>
      <TabHub
        title={lesson.title}
        tabs={[
          { key: 'build', label: 'Build', render: () => <LessonBuildTab lesson={lesson} onSaved={refresh} onGoAssign={() => goTab('assign')} /> },
          ...(checksOn ? [{ key: 'checks', label: 'Checks', render: () => <LessonChecksTab lesson={lesson} /> }] : []),
          { key: 'assign', label: 'Assign', render: () => <LessonAssignTab lesson={lesson} onGoBuild={() => goTab('build')} /> },
          ...(catchupOn ? [{ key: 'catchup', label: 'Catch-up', render: () => <LessonCatchupTab lesson={lesson} onGoAssign={() => goTab('assign')} /> }] : []),
          ...(tutorOn ? [{ key: 'tutor', label: 'Tutor', render: () => <LessonTutorTab lesson={lesson} /> }] : []),
          { key: 'results', label: 'Results', render: () => <><LessonResultsTab lesson={lesson} /><LessonCheckResults lessonId={lesson.id} /></> },
        ]}
      />
    </div>
  )
}
