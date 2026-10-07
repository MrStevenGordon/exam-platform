'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import SubstitutionManager from '@/components/substitution/SubstitutionManager'

// Arranging cover, served inside Smart Learning so the menu stays on Smart Learning: a head of department sees their department, the school admin the school.
export default function LearningSubstitutionPage() {
  const router = useRouter()
  const [role, setRole] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (cancelled) return
      if (data?.role === 'supervisor' || data?.role === 'admin') setRole(data.role)
      else router.replace('/learning')
    })
    return () => { cancelled = true }
  }, [router])
  if (!role) return null
  return <SubstitutionManager scope={role === 'supervisor' ? 'department' : 'school'} />
}
