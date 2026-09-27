'use client'

import { useParams } from 'next/navigation'
import TeacherOverview from '@/components/TeacherOverview'

export default function SchoolAdminTeacherPage() {
  const { id } = useParams<{ id: string }>()
  return <TeacherOverview teacherId={id} backHref="/school-admin/staff" backLabel="Back to staff" />
}
