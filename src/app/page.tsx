'use client'

import Link from 'next/link'
import { useState } from 'react'
import TurnstileWidget from '@/components/TurnstileWidget'

export default function HomePage() {
  const [formData, setFormData] = useState({ name: '', org: '', email: '', message: '' })
  const [website, setWebsite] = useState('') // honeypot — real users never see or fill this
  const [turnstileToken, setTurnstileToken] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

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
      <nav className="site-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 3rem', borderBottom: '1px solid var(--border)', background: 'var(--card-bg)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: 'var(--accent)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📝</div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Smart Assess Ja</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginTop: -2 }}>Smart Assess</div>
          </div>
        </div>
        <div className="site-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <a href="#features" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none', padding: '6px 10px' }}>Features</a>
          <a href="#how-it-works" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none', padding: '6px 10px' }}>How it works</a>
          <a href="#contact" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none', padding: '6px 10px' }}>Contact</a>
          <Link href="/build-my-school" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none', padding: '6px 10px' }}>Build My School</Link>
          <Link href="/org/signup" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none', padding: '6px 10px' }}>For Organizations</Link>
          <Link href="/download" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none', padding: '6px 10px' }}>Download App</Link>
          <Link href="/take-exam">
            <button className="btn btn-secondary" style={{ marginLeft: 8 }}>Take an Exam</button>
          </Link>
          <Link href="/login">
            <button className="btn btn-primary" style={{ marginLeft: 8 }}>Log in</button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ padding: '6rem 3rem 5rem', textAlign: 'center', background: 'var(--page-bg)' }}>
        <div style={{ display: 'inline-block', background: 'var(--accent-light)', color: 'var(--accent-dark)', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', padding: '4px 14px', borderRadius: 20, marginBottom: '1.5rem' }}>
          Smart Exams for Modern Education
        </div>
        <h1 style={{ fontSize: 52, fontWeight: 800, lineHeight: 1.15, margin: '0 auto 1.25rem', maxWidth: 640, color: 'var(--text-primary)', textTransform: 'none', letterSpacing: -0.5 }}>
          The smarter way to run exams and assessments
        </h1>
        <p style={{ fontSize: 20, color: 'var(--text-secondary)', maxWidth: 560, margin: '0 auto 2.5rem', lineHeight: 1.6 }}>
          One secure platform for schools and organizations across Jamaica — from pop quizzes to full final exams to one-off assessments, built around how you actually work.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="#contact">
            <button className="btn btn-primary" style={{ fontSize: 15, padding: '14px 32px' }}>Get started</button>
          </a>
          <Link href="/login">
            <button className="btn btn-secondary" style={{ fontSize: 15, padding: '14px 32px' }}>Log in</button>
          </Link>
          <Link href="/take-exam">
            <button className="btn btn-secondary" style={{ fontSize: 15, padding: '14px 32px' }}>Take an Exam</button>
          </Link>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: '1.25rem' }}>
          Organization running a one-off assessment? <Link href="/org/signup" style={{ color: 'var(--accent-dark)', fontWeight: 700 }}>Sign up here</Link> — no roster setup needed.
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          Running a school? <Link href="/build-my-school" style={{ color: 'var(--accent-dark)', fontWeight: 700 }}>Build your school&apos;s setup</Link> and request to join.
        </p>
      </section>

      {/* Stats bar */}
      <section style={{ background: 'var(--card-bg)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '1.5rem 2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          {[
            { value: '9', label: 'Exam formats' },
            { value: '6', label: 'Role-based portals' },
            { value: '0', label: 'Paper needed' },
          ].map((stat) => (
            <div key={stat.label}>
              <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--accent)' }}>{stat.value}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{ padding: '5rem 3rem', background: 'var(--page-bg)' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '0.5rem' }}>Features</div>
          <h2 style={{ fontSize: 36, fontWeight: 700, margin: 0, textTransform: 'none', color: 'var(--text-primary)' }}>Everything you need, however you work</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, maxWidth: 820, margin: '0 auto' }}>
          {[
            { icon: '🛡️', title: 'Exam integrity built in', desc: 'Fullscreen lock, tab-switch detection, single-device login, and a dedicated desktop app with kiosk-mode lockdown during exams.' },
            { icon: '📝', title: 'Tasks, Tests & Final Exams', desc: 'Flexible take-home tasks, timed proctored tests, and a review pipeline that adapts to your school — from a single sign-off to a full multi-stage chain.' },
            { icon: '👥', title: 'Role-based portals', desc: 'Student, Teacher, Supervisor, and Administrator portals, each showing only what that person needs — configured to match how your school is actually structured.' },
            { icon: '∑', title: 'Real math notation', desc: 'A proper symbol toolbar for powers, roots, fractions, Greek letters and more — plus image, audio, and video questions.' },
            { icon: '🎯', title: 'Smart grading routing', desc: 'A completed exam finds the right subject teacher automatically, based on class assignment and what they actually teach.' },
            { icon: '✨', title: 'AI-assisted authoring', desc: 'Import questions straight from a PDF exam paper, and polish rough drafts with one click.' },
            { icon: '💻', title: 'Offline-resilient desktop app', desc: 'Answers autosave locally and sync automatically — built for spotty connections, so a dropped connection never costs a student their work.' },
            { icon: '🏢', title: 'Built for organizations too', desc: 'Running a single assessment without a full school setup? Publish it with just a code and password — no roster required.' },
          ].map((f) => (
            <div key={f.title} className="card">
              <div style={{ fontSize: 24, marginBottom: '0.75rem' }}>{f.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>{f.title}</div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" style={{ padding: '5rem 3rem', background: 'var(--card-bg)' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '0.5rem' }}>How it works</div>
          <h2 style={{ fontSize: 30, fontWeight: 700, margin: 0, textTransform: 'none', color: 'var(--text-primary)' }}>From question to results — your way</h2>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', maxWidth: 480, margin: '0.75rem auto 0', lineHeight: 1.6 }}>
            Every school reviews exams differently. Smart Assess adapts to yours — from a single supervisor sign-off to a full multi-stage review chain.
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, maxWidth: 1000, margin: '0 auto' }}>
          {[
            { step: '1', title: 'Teacher creates', desc: 'Writes and organizes the exam into sections — pulling in questions from a shared bank, or importing straight from a PDF.', optional: false },
            { step: '2', title: 'Reviewed', desc: 'Anywhere from no review at all to a full department-level vetting chain — set per school, once, when it’s configured.', optional: true },
            { step: '3', title: 'Supervisor publishes', desc: 'Sets the exam window and assigns it to the right classes — students see nothing until it opens.', optional: false },
            { step: '4', title: 'Student sits exam', desc: 'Enters the access password, answers under full proctoring — on the web or the desktop app, fullscreen and monitored.', optional: false },
            { step: '5', title: 'Teacher grades & releases', desc: 'Routed automatically to the right subject teacher, who grades and releases results.', optional: false },
          ].map((s) => (
            <div
              key={s.step}
              className="card"
              style={{
                flex: '1 1 170px',
                maxWidth: 190,
                textAlign: 'center',
                border: s.optional ? '1.5px dashed var(--accent)' : '1px solid var(--border)',
                background: s.optional ? 'var(--accent-light)' : 'var(--card-bg)',
                position: 'relative',
              }}
            >
              {s.optional && (
                <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: 'var(--accent)', color: 'white', fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', padding: '2px 10px', borderRadius: 10, whiteSpace: 'nowrap' }}>
                  Optional
                </div>
              )}
              <div style={{ width: 36, height: 36, background: s.optional ? 'white' : 'var(--accent-light)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.25rem auto 0.75rem', fontSize: 15, fontWeight: 700, color: 'var(--accent-dark)' }}>{s.step}</div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Why Smart Assess */}
      <section style={{ padding: '5rem 3rem', background: 'var(--page-bg)' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '0.5rem' }}>Why Smart Assess</div>
          <h2 style={{ fontSize: 30, fontWeight: 700, margin: 0, textTransform: 'none', color: 'var(--text-primary)' }}>Built to actually hold up during an exam</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, maxWidth: 720, margin: '0 auto' }}>
          {[
            { icon: '🔒', title: 'Real proctoring, not just a checkbox', desc: 'Fullscreen lock, tab-switch detection, and single-device login are enforced automatically — not settings someone has to remember to turn on.' },
            { icon: '📡', title: 'Survives a dropped connection', desc: 'Answers save locally as a student types and sync the moment connectivity returns — a lost connection doesn’t mean lost work.' },
            { icon: '🧩', title: 'Fits your process, not the other way around', desc: 'Review workflow, exam types, and portals are configured per school — you’re not forced into someone else’s procedure.' },
          ].map((f) => (
            <div key={f.title} className="card">
              <div style={{ fontSize: 24, marginBottom: '0.75rem' }}>{f.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section id="contact" style={{ padding: '5rem 3rem', background: 'var(--card-bg)' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '0.5rem' }}>Contact</div>
          <h2 style={{ fontSize: 36, fontWeight: 700, margin: '0 0 0.75rem', textTransform: 'none', color: 'var(--text-primary)' }}>Interested in Smart Assess?</h2>
          <p style={{ fontSize: 17, color: 'var(--text-secondary)', margin: '0 0 2rem', lineHeight: 1.6 }}>
            Send us a message and we&apos;ll get back to you within one business day.
          </p>

          {submitted ? (
            <div className="card" style={{ background: 'var(--success-bg)', textAlign: 'center', padding: '2rem' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
              <h3 style={{ color: 'var(--success)', textTransform: 'none', marginBottom: 8 }}>Message received!</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>We&apos;ll be in touch within one business day.</p>
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'left' }}>
              <form onSubmit={handleSubmit}>
                {[
                  { name: 'name', label: 'Full name', placeholder: 'Jane Brown', type: 'text' },
                  { name: 'org', label: 'School / Organization name', placeholder: 'e.g. Green Valley Academy', type: 'text' },
                  { name: 'email', label: 'Email address', placeholder: 'you@example.edu.jm', type: 'email' },
                ].map((field) => (
                  <div key={field.name} style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                      {field.label}
                    </label>
                    <input
                      type={field.type}
                      name={field.name}
                      value={(formData as any)[field.name]}
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
                <div style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }} aria-hidden="true">
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
      <footer style={{ padding: '2rem', borderTop: '1px solid var(--border)', background: 'var(--page-bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, background: 'var(--accent)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>📝</div>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Smart Assess Ja</span>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <a href="#features" style={{ fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}>Features</a>
          <a href="#how-it-works" style={{ fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}>How it works</a>
          <a href="#contact" style={{ fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}>Contact</a>
          <Link href="/terms" style={{ fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}>Terms</Link>
          <Link href="/privacy" style={{ fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}>Privacy</Link>
          <Link href="/login" style={{ fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}>Log in</Link>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>© {new Date().getFullYear()} Smart Assess Ja · All rights reserved</div>
      </footer>

    </div>
  )
}
