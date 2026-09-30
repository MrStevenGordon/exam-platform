'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import Logo from '@/components/marketing/Logo'

function ChevronDown() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 3 }} aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
}

function NavDropdown({ label, items }: { label: string; items: { label: string; href: string }[] }) {
  return (
    <div className="nav-dropdown">
      <span className="nav-link">{label}<ChevronDown /></span>
      <div className="nav-dropdown-panel">
        {items.map((item) => (
          <Link key={item.href} href={item.href}>{item.label}</Link>
        ))}
      </div>
    </div>
  )
}

// The mobile panel's equivalent of NavDropdown — no hover on touch, so each group is a real
// collapsible accordion (closed by default) instead of listing every sub-item expanded at once.
function MobileNavGroup({
  label, items, open, onToggle, onNavigate,
}: {
  label: string
  items: { label: string; href: string }[]
  open: boolean
  onToggle: () => void
  onNavigate: () => void
}) {
  return (
    <div className="mobile-nav-accordion">
      <button type="button" className="mobile-nav-group" aria-expanded={open} onClick={onToggle}>
        {label}
        <ChevronDown />
      </button>
      <div className="mobile-nav-sublinks" style={{ maxHeight: open ? items.length * 48 : 0 }}>
        {items.map((item) => (
          <Link key={item.href} href={item.href} className="mobile-nav-sublink" onClick={onNavigate}>{item.label}</Link>
        ))}
      </div>
    </div>
  )
}

// The full marketing site header — logo, dropdown nav, Find My School / Request a Demo, and the
// mobile accordion menu. Shared by every public page (home, how it works, products, for
// organizations, contact) so the site reads as one place, not five one-off headers built per page.
export default function SiteNav() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [openMobileGroups, setOpenMobileGroups] = useState<Record<string, boolean>>({})

  function toggleMobileGroup(key: string) {
    setOpenMobileGroups((g) => ({ ...g, [key]: !g[key] }))
  }

  const isHome = pathname === '/'

  return (
    <nav className="site-nav" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.1rem 3rem', borderBottom: '1px solid var(--border)', background: 'rgba(253,248,243,0.92)', position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(6px)' }}>
      <Logo size={36} />

      <div className="home-nav-desktop" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Link href="/" className="nav-link" style={isHome ? { color: 'var(--text-primary)', fontWeight: 600 } : undefined}>Home</Link>
        <Link href="/download" className="nav-link">Software</Link>
        <Link href="/products" className="nav-link">Products</Link>
        <NavDropdown label="Build My School" items={[{ label: 'Overview', href: '/build-my-school#overview' }, { label: 'Start Building', href: '/build-my-school' }]} />
        <NavDropdown label="For Organizations" items={[{ label: 'Overview', href: '/for-organizations' }, { label: 'Request Access', href: '/org/signup' }]} />
        <NavDropdown label="About" items={[{ label: 'How It Works', href: '/how-it-works' }, { label: 'Contact Us', href: '/contact' }]} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link href="/find-my-school">
          <button className="btn btn-secondary" style={{ whiteSpace: 'nowrap' }}>Find My School</button>
        </Link>
        <Link href="/build-my-school" className="nav-demo-btn">
          <button className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>Request a Demo</button>
        </Link>
        <button
          type="button"
          className="nav-menu-toggle"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          style={{ display: 'none', background: 'none', border: '1px solid var(--border)', borderRadius: 8, width: 38, height: 38, alignItems: 'center', justifyContent: 'center', fontSize: 18, color: 'var(--text-primary)', cursor: 'pointer' }}
        >
          <i className={menuOpen ? 'ti ti-x' : 'ti ti-menu-2'} aria-hidden="true" />
        </button>
      </div>

      {/* Mobile menu panel (< 1280px) — flat top-level links, each dropdown's children collapsed
          into an accordion (closed by default) since there's no hover on touch. */}
      <div className={`site-nav-links${menuOpen ? ' site-nav-links-open' : ''}`} style={{ display: 'flex', flexDirection: 'column' }}>
        <Link href="/" onClick={() => setMenuOpen(false)}>Home</Link>
        <Link href="/download" onClick={() => setMenuOpen(false)}>Software</Link>
        <Link href="/products" onClick={() => setMenuOpen(false)}>Products</Link>
        <MobileNavGroup
          label="Build My School"
          items={[{ label: 'Overview', href: '/build-my-school#overview' }, { label: 'Start Building', href: '/build-my-school' }]}
          open={!!openMobileGroups['build']}
          onToggle={() => toggleMobileGroup('build')}
          onNavigate={() => setMenuOpen(false)}
        />
        <MobileNavGroup
          label="For Organizations"
          items={[{ label: 'Overview', href: '/for-organizations' }, { label: 'Request Access', href: '/org/signup' }]}
          open={!!openMobileGroups['orgs']}
          onToggle={() => toggleMobileGroup('orgs')}
          onNavigate={() => setMenuOpen(false)}
        />
        <MobileNavGroup
          label="About"
          items={[{ label: 'How It Works', href: '/how-it-works' }, { label: 'Contact Us', href: '/contact' }]}
          open={!!openMobileGroups['about']}
          onToggle={() => toggleMobileGroup('about')}
          onNavigate={() => setMenuOpen(false)}
        />
        <Link href="/build-my-school" className="btn btn-primary" style={{ marginTop: 10, justifyContent: 'center' }} onClick={() => setMenuOpen(false)}>Request a Demo</Link>
      </div>
    </nav>
  )
}
