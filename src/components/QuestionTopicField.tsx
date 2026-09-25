'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import TopicPicker from '@/components/TopicPicker'
import type { TopicChoice } from '@/lib/topics'

// The topic field for a question: takes the subject and grade from the exam the
// question belongs to. Shows nothing until the topic list exists, and if the exam
// has no grade set it explains what is missing rather than failing.
export default function QuestionTopicField({ examId, value, onChange }: { examId: string; value: string | null; onChange: (t: TopicChoice | null) => void }) {
  const [exam, setExam] = useState<{ subject: string | null; target_grade: number | null } | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase.from('draft_exams').select('subject, target_grade').eq('id', examId).maybeSingle()
      .then(({ data }) => { if (!cancelled) setExam(data) })
    return () => { cancelled = true }
  }, [examId])

  return <TopicPicker subject={exam?.subject} grade={exam?.target_grade} value={value} onChange={onChange} label="Topic (optional)" />
}
