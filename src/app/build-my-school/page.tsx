'use client'

import { useState } from 'react'
import Link from 'next/link'

const WORKFLOW_TEMPLATES = [
  {
    value: 'direct_publish',
    title: 'Direct Publish',
    desc: 'Teachers create and publish exams directly — no review chain. Fastest to run, best for smaller schools.',
  },
  {
    value: 'department_review',
    title: 'Department Head Review',
    desc: 'Teachers create exams; a department head (supervisor) reviews and publishes them.',
  },
  {
    value: 'full_review',
    title: 'Full Multi-Stage Review',
    desc: 'Team Lead creates → Senior Team Lead vets → Supervisor publishes. The most thorough option.',
  },
  {
    value: 'other',
    title: 'Other',
    desc: "None of these quite fit — describe how your school actually runs things below.",
  },
]

const FEATURES = [
  { key: 'group_projects', label: 'Group Projects', desc: 'Collaborative submissions with contribution statements and peer ratings.' },
  { key: 'homework_assignments', label: 'Homework & Assignments', desc: 'Untimed take-home work, separate from proctored exams.' },
  { key: 'ai_integrity_flags', label: 'AI Writing-Integrity Flags', desc: 'Soft flags for teacher review on possibly AI-assisted written answers.' },
  { key: 'staff_mfa', label: 'Staff Mandatory MFA', desc: 'Two-factor authentication required for all staff accounts.' },
  { key: 'calculator', label: 'Scientific Calculator', desc: 'Built-in calculator tool available during exams.' },
  { key: 'ai_authoring', label: 'AI Question Polishing / PDF Import', desc: 'Import questions from a PDF and polish rough drafts with AI.' },
]

export default function BuildMySchoolPage() {
  const [step, setStep] = useState(1)
  const [schoolName, setSchoolName] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [workflowTemplate, setWorkflowTemplate] = useState('')
  const [workflowOtherDescription, setWorkflowOtherDescription] = useState('')
  const [features, setFeatures] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  function toggleFeature(key: string) {
    setFeatures((prev) => (prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]))
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError('')

    const res = await fetch('/api/school-requests/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schoolName,
        contactName,
        contactEmail,
        workflowTemplate,
        workflowOtherDescription,
        featureFlags: features,
        notes,
      }),
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
      <div className="page-container" style={{ maxWidth: 480 }}>
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
          <h1 style={{ marginBottom: 8 }}>Request received</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Thanks — we&apos;ll review your request and follow up at {contactEmail}.
          </p>
          <Link href="/" style={{ display: 'inline-block', marginTop: 20, color: 'var(--accent-dark)', fontWeight: 600 }}>
            &larr; Back to home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container" style={{ maxWidth: 620 }}>
      <h1>Build My School</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
        Tell us how your school runs exams and which features you need — we&apos;ll review and set you up.
      </p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {[1, 2, 3, 4].map((n) => (
          <div key={n} style={{ flex: 1, height: 4, borderRadius: 2, background: n <= step ? 'var(--accent)' : 'var(--border)' }} />
        ))}
      </div>

      {error && <div className="banner banner-danger" style={{ marginBottom: 16 }}>{error}</div>}

      {step === 1 && (
        <div className="card">
          <h2 style={{ marginBottom: 12 }}>Your school</h2>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>School name</label>
            <input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} style={{ width: '100%', marginTop: 6 }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Your name</label>
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} style={{ width: '100%', marginTop: 6 }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Contact email</label>
            <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} style={{ width: '100%', marginTop: 6 }} />
          </div>
          <button
            onClick={() => setStep(2)}
            disabled={!schoolName.trim() || !contactName.trim() || !contactEmail.trim()}
            className="btn btn-primary"
            style={{ width: '100%' }}
          >
            Continue
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <h2 style={{ marginBottom: 12 }}>How does your school run exams?</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {WORKFLOW_TEMPLATES.map((t) => (
              <label
                key={t.value}
                style={{
                  display: 'flex', gap: 12, padding: 14, borderRadius: 8, cursor: 'pointer',
                  border: `1.5px solid ${workflowTemplate === t.value ? 'var(--accent)' : 'var(--border)'}`,
                  background: workflowTemplate === t.value ? 'var(--accent-light)' : 'var(--page-bg)',
                }}
              >
                <input type="radio" checked={workflowTemplate === t.value} onChange={() => setWorkflowTemplate(t.value)} style={{ marginTop: 3 }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{t.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{t.desc}</div>
                </div>
              </label>
            ))}
          </div>

          {workflowTemplate === 'other' && (
            <div style={{ marginTop: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Describe how your school runs exams
              </label>
              <textarea
                value={workflowOtherDescription}
                onChange={(e) => setWorkflowOtherDescription(e.target.value)}
                rows={4}
                placeholder="Who creates exams, who (if anyone) reviews them, and who publishes them?"
                style={{ width: '100%', marginTop: 6 }}
              />
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={() => setStep(1)} className="btn btn-ghost">Back</button>
            <button
              onClick={() => setStep(3)}
              disabled={!workflowTemplate || (workflowTemplate === 'other' && !workflowOtherDescription.trim())}
              className="btn btn-primary"
              style={{ flex: 1 }}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <h2 style={{ marginBottom: 12 }}>Which features do you need?</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {FEATURES.map((f) => (
              <label
                key={f.key}
                style={{
                  display: 'flex', gap: 12, padding: 14, borderRadius: 8, cursor: 'pointer',
                  border: `1.5px solid ${features.includes(f.key) ? 'var(--accent)' : 'var(--border)'}`,
                  background: features.includes(f.key) ? 'var(--accent-light)' : 'var(--page-bg)',
                }}
              >
                <input type="checkbox" checked={features.includes(f.key)} onChange={() => toggleFeature(f.key)} style={{ marginTop: 3 }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{f.label}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{f.desc}</div>
                </div>
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={() => setStep(2)} className="btn btn-ghost">Back</button>
            <button onClick={() => setStep(4)} className="btn btn-primary" style={{ flex: 1 }}>Continue</button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="card">
          <h2 style={{ marginBottom: 12 }}>Review & submit</h2>
          <div style={{ fontSize: 14, marginBottom: 16 }}>
            <div style={{ marginBottom: 8 }}><strong>{schoolName}</strong> · {contactName} ({contactEmail})</div>
            <div style={{ marginBottom: 8 }}>
              Workflow: <strong>{WORKFLOW_TEMPLATES.find((t) => t.value === workflowTemplate)?.title}</strong>
              {workflowTemplate === 'other' && <span> — {workflowOtherDescription}</span>}
            </div>
            <div>Features: <strong>{features.length ? features.map((f) => FEATURES.find((x) => x.key === f)?.label).join(', ') : 'None selected'}</strong></div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Anything else we should know? (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ width: '100%', marginTop: 6 }} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setStep(3)} className="btn btn-ghost">Back</button>
            <button onClick={handleSubmit} disabled={submitting} className="btn btn-primary" style={{ flex: 1 }}>
              {submitting ? 'Submitting…' : 'Submit request'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
