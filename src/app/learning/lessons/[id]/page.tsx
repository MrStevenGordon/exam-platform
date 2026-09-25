'use client'

import { useParams } from 'next/navigation'
import LessonEditor from '@/components/learning/LessonEditor'

export default function LessonEditorPage() {
  const { id } = useParams<{ id: string }>()
  return <LessonEditor lessonId={id} />
}
