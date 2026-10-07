'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { isVideosAvailable } from '@/lib/videos'
import VideosView from '@/components/learning/VideosView'

type Role = 'student' | 'teacher' | 'supervisor' | 'principal' | 'admin'

// Videos for everyone in Smart Learning. A school without migration 093 is sent back.
export default function VideosPage() {
  const router = useRouter()
  const [role, setRole] = useState<Role | null>(null)
  useEffect(() => {
    let cancelled = false
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const [{ data: profile }, ready] = await Promise.all([supabase.from('profiles').select('role').eq('id', user.id).single(), isVideosAvailable()])
      if (cancelled) return
      const r = profile?.role as Role | undefined
      if (ready && r && ['student', 'teacher', 'supervisor', 'principal', 'admin'].includes(r)) setRole(r)
      else router.replace('/learning')
    }
    check()
    return () => { cancelled = true }
  }, [router])
  return role ? <VideosView role={role} /> : null
}
