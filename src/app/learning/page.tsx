'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import ProductSwitcher from '@/components/ProductSwitcher'
import { getEnabledProducts, productHref } from '@/lib/products'

// Placeholder for Smart Learning while it is being built. It exists so the product
// switcher has somewhere to go, and it says plainly when the school has not switched
// the product on.
export default function LearningHome() {
  const router = useRouter()
  const [state, setState] = useState<'loading' | 'off' | 'soon'>('loading')
  const [role, setRole] = useState<string | undefined>()

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      const products = await getEnabledProducts()
      if (cancelled) return
      setRole(profile?.role)
      setState(products.includes('learning') ? 'soon' : 'off')
    }
    load()
    return () => { cancelled = true }
  }, [router])

  if (state === 'loading') return <div className="page-container">Loading…</div>

  return (
    <div className="page-container" style={{ maxWidth: 560 }}>
      <div style={{ background: '#2a1d14', borderRadius: 12, padding: '14px 16px', marginBottom: 20, maxWidth: 260 }}>
        <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase' }}>Smart Assess Ja</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'white', marginTop: 2 }}>Smart Learning</div>
        <ProductSwitcher role={role} />
      </div>
      {state === 'off' ? (
        <>
          <h1>Smart Learning isn&rsquo;t switched on for your school</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Your school administrator can ask for it to be added.</p>
        </>
      ) : (
        <>
          <h1>Smart Learning is on its way</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Lessons, lesson plans and progress will live here. Nothing to do yet.</p>
        </>
      )}
      <Link href={productHref('assess', role)} className="btn btn-secondary">Back to Smart Assess</Link>
    </div>
  )
}
