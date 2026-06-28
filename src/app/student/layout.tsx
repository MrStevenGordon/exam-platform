'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    async function checkAccess() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'student' && profile?.role !== 'admin') {
        router.push('/dashboard')
        return
      }

      setChecked(true)
    }
    checkAccess()
  }, [router])

  if (!checked) return <div style={{ padding: 40 }}>Checking access...</div>

  return <>{children}</>
}
