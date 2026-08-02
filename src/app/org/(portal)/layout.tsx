'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import PageTransition from '@/components/PageTransition'

export default function OrgPortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [orgName, setOrgName] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/org/login'); return }
      const { data: org } = await supabase.from('organizations').select('name').eq('auth_user_id', user.id).maybeSingle()
      if (!org) { router.push('/org/login'); return }
      setOrgName(org.name)
    }
    load()
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/org/login')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <div style={{
        background: '#FDF6EC',
        borderBottom: '1px solid var(--border)',
        padding: '14px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <Link href="/org/dashboard" style={{ textDecoration: 'none' }}>
          <div style={{ fontSize: 11, letterSpacing: 0.5, color: 'var(--text-secondary)', fontWeight: 700 }}>
            SMART ASSESS JA
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            {orgName || 'Organization Portal'}
          </div>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/org/billing" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 600 }}>Billing</Link>
          <button onClick={handleLogout} className="btn btn-ghost">Log out</button>
        </div>
      </div>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
        <PageTransition>{children}</PageTransition>
      </div>
    </div>
  )
}
