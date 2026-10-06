'use client'

import { useParams } from 'next/navigation'
import ExamInsightView from '@/components/insight/ExamInsightView'

// kind is "direct" (a test or exam the teacher set) or "final" (a school exam). Who may open it is decided in the database.
export default function TeacherInsightPage() {
  const params = useParams<{ kind: string; id: string }>()
  const kind = params.kind === 'final' ? 'final' : params.kind === 'direct' ? 'direct' : null
  if (!kind) return <div className="page-container"><div className="card">This address is not a test.</div></div>
  const back = kind === 'direct' ? { href: `/teacher/exam/${params.id}/sessions`, label: 'Back to results' } : { href: '/teacher/insight', label: 'Back to exam insight' }
  return <ExamInsightView kind={kind} examId={params.id} backHref={back.href} backLabel={back.label} />
}
