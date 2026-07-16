'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type NavItem = { label: string; icon: string; href: string }
type SidebarProps = { navItems: NavItem[]; portalLabel: string }

export default function Sidebar({ navItems, portalLabel }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [profile, setProfile] = useState<{ full_name: string; role: string; student_id?: string | null; grade_level?: number | null; departments?: { name: string } | null } | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [schoolLogoUrl, setSchoolLogoUrl] = useState<string | null>(null)

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

    async function loadLogo() {
      const { data } = await supabase.from('school_settings').select('logo_url').limit(1).single()
      if (data?.logo_url) setSchoolLogoUrl(data.logo_url)
    }
    loadLogo()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = profile?.full_name?.split(' ').map(n => n[0]).slice(0, 2).join('') || '?'

  const sidebarContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Brand */}
      <div
        onClick={() => { window.location.reload(); setMobileOpen(false) }}
        style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}
      >
        {schoolLogoUrl && (
          <img src={schoolLogoUrl} alt="School logo" style={{ maxHeight: 32, maxWidth: '100%', objectFit: 'contain', marginBottom: 10, display: 'block' }} />
        )}
        <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase' }}>
          Smart Assess Ja
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'white', marginTop: 2 }}>
          {portalLabel}
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
        {(() => {
          const hasExactMatch = navItems.some((i) => i.href === pathname)
          return navItems.map((item) => {
            const isActive = hasExactMatch ? item.href === pathname : (item.href !== '/' && pathname?.startsWith(item.href))
            return (
              <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderRadius: 8, cursor: 'pointer',
                  background: isActive ? 'rgba(212,118,42,0.25)' : 'transparent',
                  color: isActive ? '#FAC882' : 'rgba(255,255,255,0.55)',
                  fontWeight: isActive ? 600 : 400,
                  fontSize: 13,
                  borderLeft: isActive ? '3px solid #D4762A' : '3px solid transparent',
                  transition: 'all 0.1s',
                }}>
                  <i className={`ti ${item.icon}`} style={{ fontSize: 16, flexShrink: 0 }} />
                  <span>{item.label}</span>
                </div>
              </Link>
            )
          })
        })()}
      </nav>

      {/* User */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(212,118,42,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: '#FAC882', flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile?.full_name || '…'}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 1 }}>
              {profile?.student_id ? `ID: ${profile.student_id}` : profile?.role || ''}
              {profile?.grade_level ? ` · Grade ${profile.grade_level}` : ''}
              {!profile?.student_id && (profile?.departments as any)?.name ? ` · ${(profile?.departments as any)?.name}` : ''}
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{ width: '100%', padding: '7px 12px', fontSize: 12, fontWeight: 600, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: 'rgba(255,255,255,0.6)', cursor: 'pointer', letterSpacing: 0.2, textAlign: 'center' }}
        >
          Log out
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile top bar */}
      <div style={{ display: 'none' }} className="mobile-topbar">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#1A0E06', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200, height: 56 }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase' }}>Smart Assess Ja</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>{portalLabel}</div>
          </div>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', color: 'white', fontSize: 18 }}
          >
            {mobileOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 299, display: 'none' }}
          className="mobile-overlay"
        />
      )}

      {/* Desktop sidebar */}
      <div className="desktop-sidebar" style={{ width: 'clamp(180px, 18vw, 220px)', minHeight: '100vh', background: '#1A0E06', display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'sticky', top: 0, height: '100vh', zIndex: 100 }}>
        {sidebarContent}
      </div>

      {/* Mobile drawer */}
      <div className="mobile-drawer" style={{ position: 'fixed', top: 0, right: mobileOpen ? 0 : -260, width: 260, maxWidth: '80vw', height: '100dvh', background: '#1A0E06', zIndex: 300, transition: 'right 0.25s ease', display: 'none', flexDirection: 'column' }}>
        {sidebarContent}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .mobile-topbar { display: block !important; }
          .mobile-overlay { display: block !important; }
          .desktop-sidebar { display: none !important; }
          .mobile-drawer { display: flex !important; }
        }
      `}</style>
    </>
  )
}
