'use client'

import { useEffect, useState } from 'react'
import TabHub from '@/components/TabHub'
import AnalyticsView from '@/components/hod/AnalyticsView'
import IntegrityDashboard from '@/components/IntegrityDashboard'
import InsightExamList from '@/components/insight/InsightExamList'
import { isExamInsightAvailable } from '@/lib/examInsight'

export default function AnalyticsHub() {
  const [insightOn, setInsightOn] = useState(false)
  useEffect(() => { isExamInsightAvailable().then(setInsightOn) }, [])
  return (
    <TabHub
      title="Analytics"
      tabs={[
        { key: 'results', label: 'Exam Results', render: () => <AnalyticsView /> },
        ...(insightOn ? [{ key: 'insight', label: 'Exam Insight', render: () => <InsightExamList basePath="/teacher/insight" /> }] : []),
        { key: 'integrity', label: 'Integrity', render: () => <IntegrityDashboard /> },
      ]}
    />
  )
}
