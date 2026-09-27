'use client'

import { useParams } from 'next/navigation'
import TeacherOverview from '@/components/TeacherOverview'

export default function PrincipalTeacherPage() {
  const { id } = useParams<{ id: string }>()
  return <TeacherOverview teacherId={id} backHref="/principal/staff" backLabel="Back to staff" />
}
