'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { jamaicaDate, shiftDate, formatDay } from '@/lib/attendance'
import { substitutionError } from '@/lib/substitution'
import CoverLessonView, { type CoverLesson } from '@/components/substitution/CoverLessonView'

type Duty = {
  assignment_id: string; class_date: string; period_name: string; period_order: number; start_time: string | null
  subject: string; class_name: string | null; room: string | null; absent_name: string; lesson_label: string | null
}

export default function MyCoverPage() {
  const today = jamaicaDate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [duties, setDuties] = useState<Duty[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [lessons, setLessons] = useState<Record<string, CoverLesson | null>>({})
  const [lessonError, setLessonError] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error: dutyError } = await supabase.rpc('my_cover', { p_from: today, p_to: shiftDate(today, 60) })
      if (cancelled) return
      if (dutyError) setError(substitutionError(dutyError))
      setDuties((data || []) as Duty[])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [today])

  async function toggleLesson(id: string) {
    if (openId === id) { setOpenId(null); return }
    setOpenId(id)
    if (id in lessons) return
    const { data, error: lessonErr } = await supabase.rpc('cover_lesson', { p_assignment_id: id })
    if (lessonErr) { setLessonError((m) => ({ ...m, [id]: substitutionError(lessonErr) })); return }
    setLessons((m) => ({ ...m, [id]: (data as CoverLesson | null) }))
  }

  if (loading) return <div className="page-container">Loading…</div>

  const dates = Array.from(new Set(duties.map((d) => d.class_date)))

  return (
    <div className="page-container" style={{ maxWidth: 720 }}>
      <h1 className="portal-page-title">My Cover</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 20px' }}>
        Classes you have been asked to take for someone who is absent, with the lesson to teach.
      </p>

      {error && <div className="banner banner-danger" style={{ marginBottom: 16 }}>{error}</div>}
      {!error && duties.length === 0 && (
        <div className="card"><p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>You are not covering any classes right now.</p></div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {dates.map((d) => (
          <div key={d}>
            <div className="section-label" style={{ marginBottom: 6 }}>{formatDay(d)}{d === today ? ' · today' : ''}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {duties.filter((x) => x.class_date === d).map((x) => (
                <div key={x.assignment_id} className="card" style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>
                        {x.period_name}{x.start_time ? ` · ${x.start_time.slice(0, 5)}` : ''} · {x.subject}{x.class_name ? ` · ${x.class_name}` : ''}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                        Covering for {x.absent_name}{x.room ? ` · Room ${x.room}` : ''}
                      </div>
                      {x.lesson_label && <div style={{ fontSize: 12, marginTop: 2 }}>Lesson: {x.lesson_label}</div>}
                    </div>
                    <button className="btn btn-secondary" style={{ fontSize: 11 }} onClick={() => toggleLesson(x.assignment_id)}>
                      {openId === x.assignment_id ? 'Hide lesson' : 'Read lesson'}
                    </button>
                  </div>
                  {openId === x.assignment_id && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                      {lessonError[x.assignment_id] && <div className="banner banner-danger">{lessonError[x.assignment_id]}</div>}
                      {!lessonError[x.assignment_id] && !(x.assignment_id in lessons) && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>Loading the lesson…</p>}
                      {x.assignment_id in lessons && lessons[x.assignment_id] === null && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>The lesson is no longer available.</p>}
                      {lessons[x.assignment_id] && <CoverLessonView lesson={lessons[x.assignment_id] as CoverLesson} />}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
