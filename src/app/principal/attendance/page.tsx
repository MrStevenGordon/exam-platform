'use client'

import TabHub from '@/components/TabHub'
import TodayBoardView from '@/components/principal/TodayBoardView'
import TruancyView from '@/components/principal/TruancyView'
import PunctualityView from '@/components/principal/PunctualityView'

export default function AttendanceHub() {
  return (
    <TabHub
      title="Attendance"
      tabs={[
        { key: 'today', label: 'Classes', render: () => <TodayBoardView /> },
        { key: 'truancy', label: 'Truancy', render: () => <TruancyView /> },
        { key: 'teachers', label: 'Teacher punctuality', render: () => <PunctualityView /> },
      ]}
    />
  )
}
