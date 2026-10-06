'use client'

import InsightExamList from '@/components/insight/InsightExamList'

export default function InsightListPage() {
  return (
    <div>
      <h1 className="portal-page-title">Exam insight</h1>
      <InsightExamList basePath="/school-admin/insight" />
    </div>
  )
}
