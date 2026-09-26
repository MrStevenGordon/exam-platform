'use client'

import Link from 'next/link'

export type SectionTab = { label: string; href: string }

// A row of tabs that switch between related pages (each tab is a real page address, so the browser's back
// button and bookmarks work). The tab whose address the person is on is highlighted.
export default function SectionTabs({ tabs, pathname }: { tabs: SectionTab[]; pathname: string }) {
  return (
    <nav aria-label="Sections" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 20, flexWrap: 'wrap' }}>
      {tabs.map((t) => {
        const on = pathname === t.href || pathname.startsWith(t.href + '/')
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? 'page' : undefined}
            style={{
              padding: '10px 16px',
              fontSize: 14,
              fontWeight: on ? 700 : 500,
              color: on ? 'var(--accent-dark, var(--text-primary))' : 'var(--text-secondary)',
              borderBottom: `3px solid ${on ? 'var(--accent)' : 'transparent'}`,
              marginBottom: -1,
              textDecoration: 'none',
            }}
          >
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
