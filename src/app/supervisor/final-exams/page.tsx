'use client'

import TabHub from '@/components/TabHub'
import FinalExamsView from '@/components/hod/FinalExamsView'
import SubmissionsView from '@/components/hod/SubmissionsView'
import AppointmentsView from '@/components/hod/AppointmentsView'

export default function FinalExamsHub() {
  return (
    <TabHub
      title="Final Exams"
      tabs={[
        { key: 'exams', label: 'Final Exams', render: () => <FinalExamsView /> },
        { key: 'submissions', label: 'Submissions', render: () => <SubmissionsView /> },
        { key: 'team-leads', label: 'Appointments (Team Lead)', render: () => <AppointmentsView /> },
      ]}
    />
  )
}
