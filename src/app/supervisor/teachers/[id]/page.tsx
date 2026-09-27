'use client'

import { useParams } from 'next/navigation'
import TeacherOverview from '@/components/TeacherOverview'

export default function HodTeacherPage() {
  const { id } = useParams<{ id: string }>()
  return <TeacherOverview teacherId={id} backHref="/supervisor/teachers" backLabel="Back to my teachers" />
}
