'use client'

import { useState } from 'react'
import TurnstileWidget from '@/components/TurnstileWidget'
import SiteNav from '@/components/marketing/SiteNav'
import Footer from '@/components/marketing/Footer'

export default function ContactClient() {
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
      <SiteNav />

      <section style={{ padding: '5.5rem 3rem', background: 'var(--card-bg)' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
          <div className="eyebrow-tag" style={{ marginBottom: 12 }}>Contact Us</div>
          <h1 className="contact-title" style={{ fontFamily: "'Fraunces', serif", textTransform: 'none', fontSize: 30, fontWeight: 500, margin: '0 0 12px' }}>Let&apos;s build something smarter.</h1>
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
                    <label htmlFor={`contact-${field.name}`} style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                      {field.label}
                    </label>
                    <input
                      id={`contact-${field.name}`}
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
                  <label htmlFor="contact-message" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                    Message
                  </label>
                  <textarea
                    id="contact-message"
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

      <Footer />
    </div>
  )
}
