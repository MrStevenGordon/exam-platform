'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { isSupportAvailable } from '@/lib/support'
import SupportView from '@/components/learning/SupportView'

type Role = 'teacher' | 'supervisor' | 'principal' | 'admin'

// Student support, for staff only. Students, and schools without migration 092, are sent back to Smart Learning.
export default function SupportPage() {
  const router = useRouter()
  const [role, setRole] = useState<Role | null>(null)
  useEffect(() => {
    let cancelled = false
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const [{ data: profile }, ready] = await Promise.all([supabase.from('profiles').select('role').eq('id', user.id).single(), isSupportAvailable()])
      if (cancelled) return
      const r = profile?.role as string | undefined
      if (ready && (r === 'teacher' || r === 'supervisor' || r === 'principal' || r === 'admin')) setRole(r)
      else router.replace('/learning')
    }
    check()
    return () => { cancelled = true }
  }, [router])
  return role ? <SupportView role={role} /> : null
}
