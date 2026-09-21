'use client'

import TabHub from '@/components/TabHub'
import AnalyticsView from '@/components/hod/AnalyticsView'
import IntegrityDashboard from '@/components/IntegrityDashboard'

export default function AnalyticsHub() {
  return (
    <TabHub
      title="Analytics"
      tabs={[
        { key: 'results', label: 'Exam Results', render: () => <AnalyticsView /> },
        { key: 'integrity', label: 'Integrity', render: () => <IntegrityDashboard /> },
      ]}
    />
  )
}
