'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { isClassFeedbackAvailable, loadStatus, type Status } from '@/lib/classFeedback'

// A small card on "Current and future": how many classes still need the student's feedback, or the teacher's end-of-week reflection.
// It shows nothing when migration 091 is not applied, when there are no classes, or when everything is done.
export default function FeedbackReminder() {
  const [s, setS] = useState<Status>(null)
  useEffect(() => {
    let cancelled = false
    isClassFeedbackAvailable().then((ok) => (ok ? loadStatus() : null)).then((x) => { if (!cancelled) setS(x) }).catch(() => {})
    return () => { cancelled = true }
  }, [])
  if (!s || s.classes === 0 || s.done >= s.classes) return null
  const left = s.classes - s.done
  const text = s.role === 'student'
    ? `${left} of your ${s.classes} ${s.classes === 1 ? 'class is' : 'classes are'} waiting for your feedback this week.`
    : `${left} of your ${s.classes} ${s.classes === 1 ? 'class needs' : 'classes need'} an end-of-week reflection${s.responses ? `, and ${s.responses} student ${s.responses === 1 ? 'answer has' : 'answers have'} come in` : ''}.`
  return (
    <div className="card" style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 14, fontWeight: 600 }}>{text}</span>
      <Link href="/learning/feedback" className="btn btn-primary">{s.role === 'student' ? 'Give feedback' : 'Open class feedback'}</Link>
    </div>
  )
}
