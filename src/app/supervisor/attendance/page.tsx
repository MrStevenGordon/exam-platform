'use client'

import TabHub from '@/components/TabHub'
import TodayBoardView from '@/components/principal/TodayBoardView'
import TruancyView from '@/components/principal/TruancyView'
import PunctualityView from '@/components/principal/PunctualityView'

// An HOD's view of attendance across their own department's classes. (Their own
// classes' register and roll call are on the Attendance page, like a teacher's.)
export default function DepartmentAttendanceHub() {
  return (
    <TabHub
      title="Department Attendance"
      tabs={[
        { key: 'today', label: 'Classes', render: () => <TodayBoardView /> },
        { key: 'truancy', label: 'Truancy', render: () => <TruancyView linkStudents={false} /> },
        { key: 'teachers', label: 'Teacher punctuality', render: () => <PunctualityView /> },
      ]}
    />
  )
}
