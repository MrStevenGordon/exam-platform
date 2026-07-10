'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type NavItem = {
  label: string
  icon: string
  href: string
}

type SidebarProps = {
  navItems: NavItem[]
  portalLabel: string
}

export default function Sidebar({ navItems, portalLabel }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [profile, setProfile] = useState<{ full_name: string; role: string; student_id?: string | null; grade_level?: number | null; departments?: { name: string } | null } | null>(null)

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('full_name, role, student_id, grade_level, departments!profiles_department_id_fkey(name)')
        .eq('id', user.id)
        .single()
      if (data) setProfile(data as any)
    }
    loadProfile()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('')
    : '?'

  return (
    <div style={{
      width: 220,
      minHeight: '100vh',
      background: '#2A1B0F',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      position: 'sticky',
      top: 0,
      height: '100vh',
    }}>
      {/* Brand */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div
          onClick={() => { if (typeof window !== 'undefined') window.location.reload() }}
          style={{ textDecoration: 'none', cursor: 'pointer' }}
        >
          <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase' }}>
            Smart Assess Ja
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'white', marginTop: 2 }}>
            {portalLabel}
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav style={{ padding: '12px 10px', flex: 1 }}>
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 8,
                marginBottom: 2,
                fontSize: 13,
                fontWeight: isActive ? 700 : 400,
                color: isActive ? 'white' : 'rgba(255,255,255,0.55)',
                background: isActive ? '#E8924A' : 'transparent',
                transition: 'all 0.15s ease',
                cursor: 'pointer',
              }}>
                <i className={`ti ${item.icon}`} style={{ fontSize: 17 }} aria-hidden="true" />
                {item.label}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* User info + logout */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: '#E8924A',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0,
          }}>
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile?.full_name || '…'}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {profile?.student_id 
                ? `ID: ${profile.student_id}` 
                : profile?.role || ''}
              {profile?.grade_level ? ` · Grade ${profile.grade_level}` : ''}
              {!profile?.student_id && (profile?.departments as any)?.name 
                ? ` · ${(profile?.departments as any)?.name}` 
                : ''}
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            width: '100%', padding: '8px', fontSize: 12, fontWeight: 700,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8, color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
            textTransform: 'uppercase', letterSpacing: 0.4,
          }}
        >
          Log out
        </button>
      </div>
    </div>
  )
}
