'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import StudentLessonList from '@/components/learning/StudentLessonList'
import TeacherLessonList from '@/components/learning/TeacherLessonList'
import CoverageDashboard from '@/components/learning/CoverageDashboard'

export default function LearningHome() {
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!cancelled) setRole(data?.role ?? '')
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (role === null) return <div>Loading…</div>
  if (role === 'student') return <StudentLessonList />
  // The principal team's home is curriculum coverage across the whole school.
  if (role === 'principal') return <CoverageDashboard />
  return <TeacherLessonList />
}
