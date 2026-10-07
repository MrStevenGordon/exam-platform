'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import StudentWeekView from '@/components/learning/StudentWeekView'
import TeacherWeekView from '@/components/learning/TeacherWeekView'

// "Current and future" for a student and for a teacher or head of department (different content for each). Everyone else is sent back to Smart Learning.
export default function WeekPage() {
  const router = useRouter()
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (cancelled) return
      const r = profile?.role as string | undefined
      if (r === 'student' || r === 'teacher' || r === 'supervisor') setRole(r)
      else router.replace('/learning')
    }
    load()
    return () => { cancelled = true }
  }, [router])

  if (!role) return null
  return role === 'student' ? <StudentWeekView /> : <TeacherWeekView />
}
