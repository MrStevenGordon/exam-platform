'use client'

import { useState } from 'react'
import TurnstileWidget from '@/components/TurnstileWidget'

export default function WaitlistForm() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [website, setWebsite] = useState('') // honeypot — real users never see or fill this
  const [turnstileToken, setTurnstileToken] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    const res = await fetch('/api/waitlist/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, schoolName, honeypot: website, turnstileToken }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Something went wrong.')
      setSubmitting(false)
      return
    }

    setSubmitted(true)
    setSubmitting(false)
  }

  if (submitted) {
    return (
      <div className="wl-wrap">
        <p className="wl-done">You&apos;re on the list — we&apos;ll email you when we launch.</p>
        <style>{waitlistStyles}</style>
      </div>
    )
  }

  return (
    <div className="wl-wrap">
      <div className="wl-label">Join the waitlist</div>
      <form onSubmit={handleSubmit} className="wl-form">
        <input
          type="email"
          required
          placeholder="you@school.edu.jm"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="wl-input wl-input-email"
        />
        <input
          type="text"
          placeholder="Name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="wl-input"
        />
        <input
          type="text"
          placeholder="School / organization (optional)"
          value={schoolName}
          onChange={(e) => setSchoolName(e.target.value)}
          className="wl-input"
        />

        {/* Honeypot — visually hidden from real users, but a naive bot that
            autofills every field will fill this one and get silently rejected. */}
        <div style={{ display: 'none' }} aria-hidden="true">
          <label htmlFor="wl-website">Website</label>
          <input
            type="text"
            id="wl-website"
            name="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        <button type="submit" disabled={submitting || !email.trim()} className="wl-submit">
          {submitting ? 'Joining…' : 'Notify me'}
        </button>
      </form>

      <div className="wl-turnstile"><TurnstileWidget onToken={setTurnstileToken} /></div>
      {error && <p className="wl-error">{error}</p>}

      <style>{waitlistStyles}</style>
    </div>
  )
}

const waitlistStyles = `
  .wl-wrap {
    position: relative;
    z-index: 1;
    margin-top: 40px;
    padding-top: 32px;
    border-top: 1px solid #EAD9C4;
    width: 100%;
    max-width: 1060px;
  }

  .wl-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    color: #A08060;
    text-transform: uppercase;
    margin-bottom: 14px;
  }

  .wl-form {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .wl-input {
    font-family: inherit;
    font-size: 14px;
    padding: 11px 14px;
    border-radius: 8px;
    border: 1px solid #EAD9C4;
    background: #FFFFFF;
    color: #1E1208;
    min-width: 180px;
    flex: 1 1 180px;
  }

  .wl-input::placeholder { color: #A08060; }
  .wl-input:focus { outline: 2px solid #D4762A; outline-offset: 1px; }
  .wl-input-email { flex-basis: 240px; }

  .wl-submit {
    font-family: inherit;
    font-size: 14px;
    font-weight: 700;
    padding: 11px 22px;
    border-radius: 8px;
    border: none;
    background: #D4762A;
    color: #FFF9F2;
    cursor: pointer;
    flex: none;
  }

  .wl-submit:hover:not(:disabled) { background: #A85A18; }
  .wl-submit:disabled { opacity: 0.6; cursor: not-allowed; }

  .wl-turnstile { margin-top: 12px; }

  .wl-error { font-size: 13px; color: #B3261E; margin-top: 10px; }

  .wl-done {
    font-size: 14.5px;
    font-weight: 600;
    color: #A85A18;
  }

  @media (max-width: 900px) {
    .wl-wrap { text-align: center; }
    .wl-form { justify-content: center; }
  }
`
