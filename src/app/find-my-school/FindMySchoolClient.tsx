'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type School = { name: string; url: string }

export default function FindMySchoolClient() {
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/schools/directory')
      .then((res) => res.json())
      .then((data) => { if (!cancelled) setSchools(data.schools || []) })
      .catch(() => { if (!cancelled) setError('Could not load the school directory. Please try again.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const results = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return schools
    return schools.filter((s) => s.name.toLowerCase().includes(q))
  }, [schools, search])

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', minHeight: '100vh', background: 'var(--page-bg)' }}>
      <section style={{ padding: '4.5rem 1.5rem 3rem', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', background: 'var(--accent-light)', color: 'var(--accent-dark)', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', padding: '4px 14px', borderRadius: 20, marginBottom: '1.25rem' }}>
          Find my school
        </div>
        <h1 style={{ fontSize: 38, fontWeight: 800, lineHeight: 1.2, margin: '0 auto 0.75rem', maxWidth: 560, color: 'var(--text-primary)', letterSpacing: -0.5 }}>
          Where do you sign in?
        </h1>
        <p style={{ fontSize: 16, color: 'var(--text-secondary)', maxWidth: 460, margin: '0 auto', lineHeight: 1.6 }}>
          Every school runs its own private site. Search for yours below and we&apos;ll take you straight there.
        </p>
      </section>

      <section style={{ padding: '0 1.5rem 5rem', maxWidth: 560, margin: '0 auto' }}>
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <i className="ti ti-search" aria-hidden="true" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 18 }} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Start typing your school's name…"
            aria-label="Search for your school"
            autoFocus
            style={{ width: '100%', padding: '14px 16px 14px 44px', fontSize: 16, borderRadius: 10 }}
          />
        </div>

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ height: 56, borderRadius: 10, background: 'var(--card-bg)', border: '1px solid var(--border)', opacity: 0.5 }} />
            ))}
          </div>
        )}

        {!loading && error && <div className="banner banner-danger">{error}</div>}

        {!loading && !error && results.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
            <i className="ti ti-building-community" aria-hidden="true" style={{ fontSize: 32, color: 'var(--text-muted)' }} />
            <p style={{ fontWeight: 700, margin: '12px 0 4px' }}>
              {schools.length === 0 ? 'No schools are live here yet' : 'No school matches that name'}
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px' }}>
              {schools.length === 0
                ? 'Schools are being brought on one at a time — check back soon, or ask your school to get in touch.'
                : "Double-check the spelling, or ask your school's office for their sign-in link directly."}
            </p>
            <Link href="/build-my-school" className="btn btn-secondary" style={{ fontSize: 13 }}>Is your school not on Smart Assess yet?</Link>
          </div>
        )}

        {!loading && !error && results.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {results.map((s) => (
              <a
                key={s.url}
                href={s.url}
                className="card"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: 'inherit', padding: '14px 18px' }}
              >
                <span style={{ fontWeight: 700, fontSize: 15 }}>{s.name}</span>
                <i className="ti ti-arrow-right" aria-hidden="true" style={{ color: 'var(--accent)', fontSize: 18 }} />
              </a>
            ))}
          </div>
        )}

        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)', marginTop: 28 }}>
          Not sure which school you&apos;re looking for, or running a one-off assessment instead?{' '}
          <Link href="/org/signup" style={{ color: 'var(--accent-dark)', fontWeight: 700 }}>Organizations sign in here</Link>.
        </p>
      </section>
    </div>
  )
}
