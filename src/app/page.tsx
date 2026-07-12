'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function HomePage() {
  const [formData, setFormData] = useState({ name: '', school: '', email: '', message: '' })
  const [submitted, setSubmitted] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
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
        <h1 style={{ fontSize: 52, fontWeight: 800, lineHeight: 1.15, margin: '0 auto 1.25rem', maxWidth: 600, color: 'var(--text-primary)', textTransform: 'none', letterSpacing: -0.5 }}>
          The smarter way to run exams at your school
        </h1>
        <p style={{ fontSize: 20, color: 'var(--text-secondary)', maxWidth: 540, margin: '0 auto 2.5rem', lineHeight: 1.6 }}>
          Built for Jamaican schools — from pop quizzes to end-of-year exams, all in one platform — all in one secure platform.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="#contact">
            <button className="btn btn-primary" style={{ fontSize: 15, padding: '14px 32px' }}>Get started</button>
          </a>
          <Link href="/login">
            <button className="btn btn-secondary" style={{ fontSize: 15, padding: '14px 32px' }}>Log in</button>
          </Link>
        </div>
        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent-dark)', marginTop: '1rem', letterSpacing: 0.3 }}>Currently serving Manchester High School · Jamaica</p>
      </section>

      {/* Stats bar */}
      <section style={{ background: 'var(--card-bg)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '1.5rem 2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          {[
            { value: '5', label: 'Exam types' },
            { value: '100%', label: 'Browser-based' },
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
          <h2 style={{ fontSize: 36, fontWeight: 700, margin: 0, textTransform: 'none', color: 'var(--text-primary)' }}>Everything your school needs</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, maxWidth: 820, margin: '0 auto' }}>
          {[
            { icon: '🛡️', title: 'Anti-cheating built in', desc: 'Fullscreen lock, tab monitoring, auto-submit on violations, and per-student answer shuffling.' },
            { icon: '📊', title: 'Real-time analytics', desc: 'Class averages, score distributions, and question difficulty breakdowns — instantly after results.' },
            { icon: '👥', title: 'Role-based access', desc: 'Separate portals for students, teachers, supervisors, and administrators — each sees only what they need.' },
            { icon: '📋', title: 'Two exam pipelines', desc: 'Supervisor-approved finals and teacher-direct quizzes — with full review and approval workflows.' },
            { icon: '🔒', title: 'Exam access passwords', desc: 'Auto-generated 6-character codes distributed on exam day — students can\'t begin without it.' },
            { icon: '✨', title: 'AI question assistance', desc: 'Teachers polish rough question drafts with AI — improved wording and distractor suggestions instantly.' },
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
          <h2 style={{ fontSize: 30, fontWeight: 700, margin: 0, textTransform: 'none', color: 'var(--text-primary)' }}>From question to results in four steps</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', maxWidth: 780, margin: '0 auto', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          {[
            { step: '1', title: 'Teacher creates', desc: 'Writes questions across 5 types — MCQ, T/F, short answer, fill in the blank, or essay.' },
            { step: '2', title: 'Supervisor reviews', desc: 'Approves or sends feedback per question, then assembles and publishes the final exam.' },
            { step: '3', title: 'Students sit exam', desc: 'Enter the access password, answer page by page in fullscreen — timer counts down live.' },
            { step: '4', title: 'Results released', desc: 'Supervisor releases grades — students see scores, class comparison, and full question review.' },
          ].map((s, i, arr) => (
            <div key={s.step} style={{ padding: '1.5rem', borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none', textAlign: 'center' }}>
              <div style={{ width: 40, height: 40, background: 'var(--accent-light)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: 16, fontWeight: 700, color: 'var(--accent-dark)' }}>{s.step}</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{s.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section style={{ padding: '5rem 3rem', background: 'var(--page-bg)' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '0.5rem' }}>Testimonials</div>
          <h2 style={{ fontSize: 30, fontWeight: 700, margin: 0, textTransform: 'none', color: 'var(--text-primary)' }}>What schools are saying</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, maxWidth: 720, margin: '0 auto' }}>
          {[
            { quote: 'Smart Assess has transformed how we manage examinations. The anti-cheating features alone have made a measurable difference.', name: 'A. Thompson', role: 'Head of Department' },
            { quote: 'The analytics tell me instantly which questions students struggled with — I can adjust my teaching before the term ends.', name: 'M. Campbell', role: 'Mathematics Teacher' },
            { quote: 'Students actually prefer this to paper exams. They get immediate feedback and can review every question afterwards.', name: 'R. Brown', role: 'Vice Principal' },
          ].map((t) => (
            <div key={t.name} className="card">
              <div style={{ fontSize: 28, color: 'var(--accent)', marginBottom: '0.75rem', lineHeight: 1 }}>"</div>
              <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 1rem' }}>{t.quote}</p>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{t.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.role} · Placeholder</div>
            </div>
          ))}
        </div>
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: '1.5rem' }}>
          Testimonials are placeholders — replace with real quotes once collected.
        </p>
      </section>

      {/* Contact */}
      <section id="contact" style={{ padding: '5rem 3rem', background: 'var(--card-bg)' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '0.5rem' }}>Contact</div>
          <h2 style={{ fontSize: 36, fontWeight: 700, margin: '0 0 0.75rem', textTransform: 'none', color: 'var(--text-primary)' }}>Interested in Smart Assess for your school?</h2>
          <p style={{ fontSize: 17, color: 'var(--text-secondary)', margin: '0 0 2rem', lineHeight: 1.6 }}>
            Send us a message and we'll get back to you within one business day.
          </p>

          {submitted ? (
            <div className="card" style={{ background: 'var(--success-bg)', textAlign: 'center', padding: '2rem' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
              <h3 style={{ color: 'var(--success)', textTransform: 'none', marginBottom: 8 }}>Message received!</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>We'll be in touch within one business day.</p>
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'left' }}>
              <form onSubmit={handleSubmit}>
                {[
                  { name: 'name', label: 'Full name', placeholder: 'Principal Janet Brown', type: 'text' },
                  { name: 'school', label: 'School name', placeholder: 'Manchester High School', type: 'text' },
                  { name: 'email', label: 'Email address', placeholder: 'principal@school.edu.jm', type: 'email' },
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
                    placeholder="Tell us about your school and what you're looking for…"
                    required
                    style={{ width: '100%' }}
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                  Send message
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
          <Link href="/login" style={{ fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}>Log in</Link>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>© {new Date().getFullYear()} Smart Assess Ja · All rights reserved</div>
      </footer>

    </div>
  )
}
