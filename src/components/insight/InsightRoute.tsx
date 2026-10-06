'use client'

import { useParams } from 'next/navigation'
import ExamInsightView from '@/components/insight/ExamInsightView'

// The Insight page for one test or exam inside a portal. listHref is that portal's own list of exams.
export default function InsightRoute({ listHref, listLabel }: { listHref: string; listLabel: string }) {
  const params = useParams<{ kind: string; id: string }>()
  const kind = params.kind === 'final' ? 'final' : params.kind === 'direct' ? 'direct' : null
  if (!kind) return <div className="page-container"><div className="card">This address is not a test.</div></div>
  return <ExamInsightView kind={kind} examId={params.id} backHref={listHref} backLabel={listLabel} />
}
