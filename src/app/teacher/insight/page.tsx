'use client'

import InsightExamList from '@/components/insight/InsightExamList'

// Every test and school exam this teacher (or head of department) may open Insight for.
export default function TeacherInsightListPage() {
  return (
    <div>
      <h1 className="portal-page-title">Exam insight</h1>
      <InsightExamList basePath="/teacher/insight" />
    </div>
  )
}
