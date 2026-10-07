'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { isSupportAvailable } from '@/lib/support'
import MyProgressView from '@/components/learning/MyProgressView'

// A student's own progress. Other roles, or a school without migration 092, are sent back to Smart Learning.
export default function ProgressPage() {
  const router = useRouter()
  const [ok, setOk] = useState(false)
  useEffect(() => {
    let cancelled = false
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const [{ data: profile }, ready] = await Promise.all([supabase.from('profiles').select('role').eq('id', user.id).single(), isSupportAvailable()])
      if (cancelled) return
      if (ready && profile?.role === 'student') setOk(true)
      else router.replace('/learning')
    }
    check()
    return () => { cancelled = true }
  }, [router])
  return ok ? <MyProgressView /> : null
}
