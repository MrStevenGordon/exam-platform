'use client'

import Link from 'next/link'
import { useState } from 'react'
import TurnstileWidget from '@/components/TurnstileWidget'
import Logo from '@/components/marketing/Logo'
import { PRODUCTS } from '@/lib/products'

const PRODUCT_DETAILS: Record<keyof typeof PRODUCTS, string> = {
  assess: 'Timed tests, take-home tasks and full final exams, with a review chain that matches how your department actually signs off.',
  learning: 'Teachers plan lessons on the National Standards Curriculum template, with AI-assisted drafting and a cross-school library to build on.',
  play: 'Short, game-based practice students can return to on their own, reinforcing what a lesson already covered.',
}

const IDEA_STEPS = [
  { n: '01', title: 'Create', icon: 'ti-pencil', desc: 'Build exams and lesson plans from a shared question bank, with AI-assisted drafting and real math notation.' },
  { n: '02', title: 'Deliver', icon: 'ti-send-2', desc: 'Run tests, tasks and full exams in a secure, proctored environment, on the web or the desktop app.' },
  { n: '03', title: 'Analyze', icon: 'ti-chart-bar', desc: 'See exactly where each class and student stands, down to the individual question.' },
  { n: '04', title: 'Act', icon: 'ti-target-arrow', desc: 'Turn results into targeted lessons in Smart Learning and follow-up practice in Smart Play.' },
]

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

export default function HomePage() {
  const [formData, setFormData] = useState({ name: '', org: '', email: '', message: '' })
  const [website, setWebsite] = useState('') // honeypot — real users never see or fill this
  const [turnstileToken, setTurnstileToken] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const res = await fetch('/api/contact/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...formData, honeypot: website, turnstileToken }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Something went wrong. Please try again.')
      setSubmitting(false)
      return
    }

    setSubmitted(true)
    setSubmitting(false)
  }

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: 'var(--text-primary)' }}>

      {/* Nav */}
      <nav className="site-nav" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.1rem 3rem', borderBottom: '1px solid var(--border)', background: 'rgba(253,248,243,0.92)', position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(6px)' }}>
        <Logo size={36} />

        <div className="home-nav-desktop" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Link href="/" className="nav-link" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Home</Link>
          <Link href="/download" className="nav-link">Software</Link>
          <a href="#products" className="nav-link">Products</a>
          <NavDropdown label="Build My School" items={[{ label: 'Overview', href: '/build-my-school#overview' }, { label: 'Start Building', href: '/build-my-school' }]} />
          <NavDropdown label="For Organizations" items={[{ label: 'Overview', href: '#organizations' }, { label: 'Request Access', href: '/org/signup' }]} />
          <NavDropdown label="About" items={[{ label: 'How It Works', href: '#how-it-works' }, { label: 'Contact Us', href: '#contact' }]} />
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

        {/* Mobile menu panel (< 1024px) — flat, every link visible at once, dropdown children shown as an indented sub-line since there's no hover on touch */}
        <div className={`site-nav-links${menuOpen ? ' site-nav-links-open' : ''}`} style={{ display: 'flex', flexDirection: 'column' }}>
          <Link href="/" onClick={() => setMenuOpen(false)}>Home</Link>
          <Link href="/download" onClick={() => setMenuOpen(false)}>Software</Link>
          <a href="#products" onClick={() => setMenuOpen(false)}>Products</a>
          <div className="mobile-nav-group">Build My School</div>
          <Link href="/build-my-school#overview" className="mobile-nav-sublink" onClick={() => setMenuOpen(false)}>Overview</Link>
          <Link href="/build-my-school" className="mobile-nav-sublink" onClick={() => setMenuOpen(false)}>Start Building</Link>
          <div className="mobile-nav-group">For Organizations</div>
          <a href="#organizations" className="mobile-nav-sublink" onClick={() => setMenuOpen(false)}>Overview</a>
          <Link href="/org/signup" className="mobile-nav-sublink" onClick={() => setMenuOpen(false)}>Request Access</Link>
          <div className="mobile-nav-group">About</div>
          <a href="#how-it-works" className="mobile-nav-sublink" onClick={() => setMenuOpen(false)}>How It Works</a>
          <a href="#contact" className="mobile-nav-sublink" onClick={() => setMenuOpen(false)}>Contact Us</a>
          <Link href="/build-my-school" className="btn btn-primary" style={{ marginTop: 10, justifyContent: 'center' }} onClick={() => setMenuOpen(false)}>Request a Demo</Link>
        </div>
      </nav>

      {/* Hero */}
      <section id="home" style={{ padding: '5.5rem 3rem 6rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4rem' }}>
        <div style={{ flex: '1 1 480px', display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 560 }}>
          <div className="eyebrow-tag">Learn &middot; Assess &middot; Play</div>
          <h1 className="hero-title" style={{ fontFamily: "'Fraunces', serif", textTransform: 'none', fontSize: 62, fontWeight: 600, lineHeight: 1.08, letterSpacing: -1.2, color: 'var(--text-primary)', margin: 0 }}>
            Smarter Assessments.<br />Better Learning.
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0 }}>
            A connected platform for schools and organizations across Jamaica, bringing exams, lessons and practice into one place, built around how your school actually works.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/build-my-school">
              <button className="btn btn-primary" style={{ fontSize: 15, padding: '14px 30px' }}>Request a Demo</button>
            </Link>
            <Link href="/find-my-school">
              <button className="btn btn-secondary" style={{ fontSize: 15, padding: '14px 30px' }}>Find My School</button>
            </Link>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Free to request, no commitment. We&apos;ll walk you through the platform personally.</p>
        </div>

        {/* Illustrative interface composition — not a real screenshot */}
        <div style={{ flex: '1 1 380px', maxWidth: 460, margin: '0 auto' }}>
          <div className="card" style={{ borderRadius: 18, padding: 22, boxShadow: '0 24px 48px -18px rgba(30,18,8,0.16)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Form 4 &middot; Mathematics</div>
              <span className="badge" style={{ background: 'var(--accent-light)', color: 'var(--accent-dark)' }}>Live</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {[70, 60, 80].map((w, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 11, background: 'var(--page-bg)', border: '1px solid var(--border)', borderRadius: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--accent-light)', flexShrink: 0 }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ height: 7, width: `${w}%`, background: '#EDE0CD', borderRadius: 4 }} />
                    <div style={{ height: 5, width: `${w * 0.6}%`, background: '#F3E9DA', borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: '#1A0E06', borderRadius: 18, padding: 20, marginTop: -34, marginLeft: '20%', width: '75%', boxShadow: '0 24px 48px -18px rgba(30,18,8,0.3)', position: 'relative' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 }}>Class average</div>
            <div style={{ fontFamily: "'Fraunces', serif", textTransform: 'none', fontSize: 34, fontWeight: 600, color: 'white', marginBottom: 12 }}>78<span style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)' }}>%</span></div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 40 }}>
              {[55, 70, 45, 90, 65, 80].map((h, i) => (
                <div key={i} style={{ flex: 1, height: `${h}%`, background: i === 3 ? 'var(--accent)' : 'rgba(212,118,42,0.45)', borderRadius: '3px 3px 0 0' }} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* The problem */}
      <section style={{ padding: '4.5rem 3rem', background: 'var(--card-bg)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
        <div className="eyebrow-tag" style={{ marginBottom: 16 }}>The problem</div>
        <h2 className="problem-title" style={{ fontFamily: "'Fraunces', serif", textTransform: 'none', fontSize: 38, fontWeight: 500, letterSpacing: -0.5, maxWidth: 720, margin: '0 auto 16px' }}>Assessment shouldn&apos;t stop at a grade.</h2>
        <p style={{ fontSize: 16, color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>A score alone doesn&apos;t tell a teacher what to do next. The result should point straight back to the lesson, the practice, and the students who need it.</p>
      </section>

      {/* The idea */}
      <section id="how-it-works" style={{ padding: '5.5rem 3rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div className="eyebrow-tag" style={{ marginBottom: 12 }}>The idea</div>
          <h2 className="idea-title" style={{ fontFamily: "'Fraunces', serif", textTransform: 'none', fontSize: 34, fontWeight: 500, letterSpacing: -0.5, margin: 0 }}>From assessment to action.</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 32, maxWidth: 1100, margin: '0 auto' }}>
          {IDEA_STEPS.map((step) => (
            <div key={step.n} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: 13, background: 'var(--accent-light)', color: 'var(--accent-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21 }}>
                <i className={`ti ${step.icon}`} aria-hidden="true" />
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1 }}>{step.n}</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{step.title}</div>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* The platform */}
      <section style={{ padding: '5.5rem 3rem', background: '#1A0E06' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div className="eyebrow-tag" style={{ color: '#E8A868', marginBottom: 12 }}>The platform</div>
          <h2 className="platform-title" style={{ fontFamily: "'Fraunces', serif", textTransform: 'none', fontSize: 34, fontWeight: 500, color: 'white', letterSpacing: -0.5, margin: '0 0 10px' }}>One place, not five different logins.</h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>Available on the web and as a dedicated desktop app, built to keep working through a dropped connection.</p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ flex: '1.2 1 360px', background: '#241505', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: 26, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>Mid-Term Exam: Biology</div>
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: 1 }}>QUESTION 4 OF 20</div>
              <div style={{ height: 9, width: '90%', background: 'rgba(255,255,255,0.15)', borderRadius: 4 }} />
              <div style={{ height: 9, width: '70%', background: 'rgba(255,255,255,0.15)', borderRadius: 4 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', border: '1.5px solid var(--accent)', borderRadius: 8, background: 'rgba(212,118,42,0.12)' }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1.5px solid var(--accent)', flexShrink: 0 }} />
                  <div style={{ height: 6, width: '55%', background: 'rgba(255,255,255,0.35)', borderRadius: 4 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.25)', flexShrink: 0 }} />
                  <div style={{ height: 6, width: '40%', background: 'rgba(255,255,255,0.15)', borderRadius: 4 }} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>Autosaved &middot; offline-ready</span>
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>18:42 remaining</span>
            </div>
          </div>
          <div style={{ flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ background: '#241505', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: 22 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Graded &amp; released</div>
              <div style={{ fontFamily: "'Fraunces', serif", textTransform: 'none', fontSize: 30, fontWeight: 600, color: 'white' }}>142<span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}> submissions</span></div>
            </div>
            <div style={{ background: '#241505', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: 22, display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase' }}>Strand breakdown</div>
              {[['Genetics', 84, false], ['Ecology', 61, false], ['Cell biology', 38, true]].map(([label, pct, gold]) => (
                <div key={label as string} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{ width: 82, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{label}</div>
                  <div style={{ flex: 1, height: 7, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: gold ? '#E8A868' : 'var(--accent)' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* The ecosystem */}
      <section id="products" style={{ padding: '5.5rem 3rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div className="eyebrow-tag" style={{ marginBottom: 12 }}>The ecosystem</div>
          <h2 className="ecosystem-title" style={{ fontFamily: "'Fraunces', serif", textTransform: 'none', fontSize: 34, fontWeight: 500, letterSpacing: -0.5, margin: '0 0 10px' }}>Three products, one sign-in.</h2>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', maxWidth: 520, margin: '0 auto', lineHeight: 1.6 }}>
            Every school starts with Smart Assess. Smart Learning and Smart Play switch on whenever you&apos;re ready, at no extra cost to set up.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, maxWidth: 1100, margin: '0 auto' }}>
          {(Object.keys(PRODUCTS) as (keyof typeof PRODUCTS)[]).map((key) => (
            <div key={key} className="card" style={{ padding: '2rem 1.75rem' }}>
              <div style={{ width: 44, height: 44, background: 'var(--accent-light)', color: 'var(--accent-dark)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 14 }}>
                <i className={`ti ${PRODUCTS[key].icon}`} aria-hidden="true" />
              </div>
              <div style={{ fontWeight: 700, fontSize: 19 }}>{PRODUCTS[key].label}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.5, margin: '4px 0 10px' }}>{PRODUCTS[key].tagline}</div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{PRODUCT_DETAILS[key]}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Who it's for */}
      <section style={{ padding: '0 3rem 5.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div className="eyebrow-tag">Who it&apos;s for</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, maxWidth: 1100, margin: '0 auto' }}>
          <Link href="/build-my-school" className="card" style={{ padding: '2.25rem', display: 'flex', flexDirection: 'column', gap: 14, textDecoration: 'none', color: 'inherit' }}>
            <i className="ti ti-school" aria-hidden="true" style={{ fontSize: 26, color: 'var(--accent)' }} />
            <h3 style={{ fontFamily: "'Fraunces', serif", textTransform: 'none', fontSize: 22, fontWeight: 500, margin: 0 }}>Schools</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>Your own portal, configured around how your school actually structures exams, departments and classes.</p>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-dark)', display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>Build My School <i className="ti ti-arrow-right" aria-hidden="true" /></span>
          </Link>
          <div id="organizations" className="card" style={{ padding: '2.25rem', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <i className="ti ti-building" aria-hidden="true" style={{ fontSize: 26, color: 'var(--accent)' }} />
            <h3 style={{ fontFamily: "'Fraunces', serif", textTransform: 'none', fontSize: 22, fontWeight: 500, margin: 0 }}>Organizations</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>Publish a single training, certification or screening assessment with just a code and password. No roster required.</p>
            <Link href="/org/signup" style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-dark)', display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>Request Access <i className="ti ti-arrow-right" aria-hidden="true" /></Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ padding: '4.5rem 3rem', background: 'var(--accent-light)', textAlign: 'center' }}>
        <h2 className="cta-title" style={{ fontFamily: "'Fraunces', serif", textTransform: 'none', fontSize: 40, fontWeight: 500, letterSpacing: -0.6, maxWidth: 560, margin: '0 auto 22px' }}>Ready to rethink assessment?</h2>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/build-my-school">
            <button className="btn btn-dark" style={{ fontSize: 15, padding: '14px 30px' }}>Request a Demo</button>
          </Link>
          <Link href="/find-my-school">
            <button className="btn btn-secondary" style={{ fontSize: 15, padding: '14px 30px' }}>Find My School</button>
          </Link>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" style={{ padding: '5.5rem 3rem', background: 'var(--card-bg)' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
          <div className="eyebrow-tag" style={{ marginBottom: 12 }}>Contact Us</div>
          <h2 className="contact-title" style={{ fontFamily: "'Fraunces', serif", textTransform: 'none', fontSize: 30, fontWeight: 500, margin: '0 0 12px' }}>Let&apos;s build something smarter.</h2>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', margin: '0 0 8px', lineHeight: 1.6 }}>Send us a message and we&apos;ll get back to you within one business day.</p>
          <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap', fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 28px' }}>
            <span>sales@smartassessja.com</span>
            <span>876-394-4211</span>
            <span>Jamaica</span>
          </div>

          {submitted ? (
            <div className="card" style={{ background: 'var(--success-bg)', textAlign: 'center', padding: '2rem' }}>
              <i className="ti ti-circle-check" aria-hidden="true" style={{ fontSize: 32, color: 'var(--success)' }} />
              <h3 style={{ color: 'var(--success)', textTransform: 'none', margin: '12px 0 8px' }}>Message received!</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>We&apos;ll be in touch within one business day.</p>
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'left' }}>
              <form onSubmit={handleSubmit}>
                {([
                  { name: 'name', label: 'Full name', placeholder: 'Jane Brown', type: 'text' },
                  { name: 'org', label: 'School / Organization name', placeholder: 'e.g. Green Valley Academy', type: 'text' },
                  { name: 'email', label: 'Email address', placeholder: 'you@example.edu.jm', type: 'email' },
                ] as const).map((field) => (
                  <div key={field.name} style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                      {field.label}
                    </label>
                    <input
                      type={field.type}
                      name={field.name}
                      value={formData[field.name]}
                      onChange={handleChange}
                      placeholder={field.placeholder}
                      required
                      style={{ width: '100%' }}
                    />
                  </div>
                ))}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                    Message
                  </label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Tell us about your school or organization and what you're looking for…"
                    required
                    style={{ width: '100%' }}
                  />
                </div>
                {/* Honeypot — visually hidden from real users, but a naive bot that
                    autofills every field will fill this one and get silently rejected. */}
                <div style={{ display: 'none' }} aria-hidden="true">
                  <label htmlFor="website">Website</label>
                  <input
                    type="text"
                    id="website"
                    name="website"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </div>

                <TurnstileWidget onToken={setTurnstileToken} />

                {error && (
                  <div className="banner banner-danger" style={{ marginBottom: 16, fontSize: 13 }}>
                    {error}
                  </div>
                )}

                <button type="submit" disabled={submitting} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                  {submitting ? 'Sending…' : 'Send message'}
                </button>
              </form>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '2rem 3rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <Logo size={26} />
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <a href="#products" style={{ fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}>Products</a>
          <a href="#how-it-works" style={{ fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}>How it works</a>
          <a href="#contact" style={{ fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}>Contact</a>
          <Link href="/download" style={{ fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}>Download App</Link>
          <Link href="/terms" style={{ fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}>Terms</Link>
          <Link href="/privacy" style={{ fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}>Privacy</Link>
          <Link href="/find-my-school" style={{ fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}>Find My School</Link>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>&copy; {new Date().getFullYear()} Smart Assess Ja &middot; All rights reserved</div>
      </footer>

    </div>
  )
}
