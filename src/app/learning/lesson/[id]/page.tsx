'use client'

import { useParams } from 'next/navigation'
import StudentLessonView from '@/components/learning/StudentLessonView'

export default function StudentLessonPage() {
  const { id } = useParams<{ id: string }>()
  return <StudentLessonView lessonId={id} />
}
