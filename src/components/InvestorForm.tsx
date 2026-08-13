'use client'

import { useState } from 'react'
import TurnstileWidget from '@/components/TurnstileWidget'

export default function InvestorForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [firm, setFirm] = useState('')
  const [note, setNote] = useState('')
  const [website, setWebsite] = useState('') // honeypot — real users never see or fill this
  const [turnstileToken, setTurnstileToken] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    const res = await fetch('/api/investor-inquiries/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, firm, note, honeypot: website, turnstileToken }),
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
      <div className="inv-wrap">
        <p className="inv-done">Thanks — we&apos;ll be in touch directly.</p>
        <style>{investorStyles}</style>
      </div>
    )
  }

  return (
    <div className="inv-wrap">
      <div className="inv-label">For investors</div>
      <p className="inv-intro">Interested in backing Smart Assess Ja? Leave your details and we&apos;ll reach out.</p>
      <form onSubmit={handleSubmit} className="inv-form">
        <div className="inv-row">
          <input
            type="text"
            required
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="inv-input"
          />
          <input
            type="email"
            required
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="inv-input"
          />
          <input
            type="text"
            placeholder="Firm (optional)"
            value={firm}
            onChange={(e) => setFirm(e.target.value)}
            className="inv-input"
          />
        </div>
        <textarea
          placeholder="What are you interested in? (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="inv-textarea"
          rows={3}
        />

        {/* Honeypot — visually hidden from real users, but a naive bot that
            autofills every field will fill this one and get silently rejected. */}
        <div style={{ display: 'none' }} aria-hidden="true">
          <label htmlFor="inv-website">Website</label>
          <input
            type="text"
            id="inv-website"
            name="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        <button type="submit" disabled={submitting || !name.trim() || !email.trim()} className="inv-submit">
          {submitting ? 'Sending…' : 'Get in touch'}
        </button>
      </form>

      <div className="inv-turnstile"><TurnstileWidget onToken={setTurnstileToken} /></div>
      {error && <p className="inv-error">{error}</p>}

      <style>{investorStyles}</style>
    </div>
  )
}

const investorStyles = `
  .inv-wrap {
    position: relative;
    z-index: 1;
    flex: 1 1 300px;
    min-width: 280px;
  }

  .inv-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    color: #A08060;
    text-transform: uppercase;
    margin-bottom: 8px;
  }

  .inv-intro {
    font-size: 14px;
    color: #6B4F35;
    margin: 0 0 14px;
  }

  .inv-form {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .inv-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .inv-input, .inv-textarea {
    font-family: inherit;
    font-size: 14px;
    padding: 11px 14px;
    border-radius: 8px;
    border: 1px solid #EAD9C4;
    background: #FFFFFF;
    color: #1E1208;
  }

  .inv-input {
    min-width: 180px;
    flex: 1 1 180px;
  }

  .inv-textarea {
    width: 100%;
    resize: vertical;
    font-family: inherit;
  }

  .inv-input::placeholder, .inv-textarea::placeholder { color: #A08060; }
  .inv-input:focus, .inv-textarea:focus { outline: 2px solid #D4762A; outline-offset: 1px; }

  .inv-submit {
    font-family: inherit;
    font-size: 14px;
    font-weight: 700;
    padding: 11px 22px;
    border-radius: 8px;
    border: none;
    background: #D4762A;
    color: #FFF9F2;
    cursor: pointer;
    align-self: flex-start;
  }

  .inv-submit:hover:not(:disabled) { background: #A85A18; }
  .inv-submit:disabled { opacity: 0.6; cursor: not-allowed; }

  .inv-turnstile { margin-top: 12px; }

  .inv-error { font-size: 13px; color: #B3261E; margin-top: 10px; }

  .inv-done {
    font-size: 14.5px;
    font-weight: 600;
    color: #A85A18;
  }

  @media (max-width: 900px) {
    .inv-wrap { text-align: center; }
    .inv-row { justify-content: center; }
    .inv-submit { align-self: center; }
  }
`
