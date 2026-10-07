'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { isClassFeedbackAvailable } from '@/lib/classFeedback'
import StudentFeedbackView from '@/components/learning/StudentFeedbackView'
import StaffFeedbackView from '@/components/learning/StaffFeedbackView'

type Role = 'student' | 'teacher' | 'supervisor' | 'principal' | 'admin'

// Weekly class feedback: students answer for each class, staff read the report. Everyone else, or a school without migration 091, is sent back.
export default function ClassFeedbackPage() {
  const router = useRouter()
  const [role, setRole] = useState<Role | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const [{ data: profile }, ready] = await Promise.all([supabase.from('profiles').select('role').eq('id', user.id).single(), isClassFeedbackAvailable()])
      if (cancelled) return
      const r = profile?.role as Role | undefined
      if (ready && r && ['student', 'teacher', 'supervisor', 'principal', 'admin'].includes(r)) setRole(r)
      else router.replace('/learning')
    }
    load()
    return () => { cancelled = true }
  }, [router])

  if (!role) return null
  return role === 'student' ? <StudentFeedbackView /> : <StaffFeedbackView role={role} />
}
