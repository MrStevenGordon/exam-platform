'use client'

import TabHub from '@/components/TabHub'
import MyClassesView from '@/components/hod/MyClassesView'
import StudentsView from '@/components/hod/StudentsView'
import ClassAssignmentsView from '@/components/hod/ClassAssignmentsView'

export default function ClassroomsHub() {
  return (
    <TabHub
      title="Classrooms"
      tabs={[
        { key: 'classes', label: 'My Classes', render: () => <MyClassesView /> },
        { key: 'students', label: 'Students', render: () => <StudentsView /> },
        { key: 'assignments', label: 'Class Assignments', render: () => <ClassAssignmentsView /> },
      ]}
    />
  )
}
