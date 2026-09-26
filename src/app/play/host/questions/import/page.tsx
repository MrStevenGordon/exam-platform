'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TYPE_LABELS, QuestionType } from '../QuestionForm'

type Issue = { row: number; message: string }
type Report = {
  committed: boolean
  total: number
  importable: number
  imported: number
  duplicateCount: number
  errorCount: number
  errors: Issue[]
  duplicates: Issue[]
  topics: { label: string; count: number }[]
  sample: { row: number; subject: string; topic: string; type: QuestionType; question: string; correctAnswer: string; points: number }[]
}

const MAX_BYTES = 1_000_000

export default function ImportQuestionsPage() {
  const router = useRouter()
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const [status, setStatus] = useState<'draft' | 'approved'>('draft')
  const [report, setReport] = useState<Report | null>(null)
  const [busy, setBusy] = useState<'check' | 'import' | null>(null)
  const [error, setError] = useState('')

  function reset() {
    setReport(null)
    setError('')
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    reset()
    if (!file) return
    if (file.size > MAX_BYTES) { setError('That file is too large. Split it into smaller files.'); return }
    setFileName(file.name)
    setText(await file.text())
  }

  async function run(commit: boolean) {
    setBusy(commit ? 'import' : 'check')
    setError('')
    try {
      const res = await fetch('/api/play/host/questions/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, status, commit }),
      })
      if (res.status === 401) { router.push('/play/login'); return }
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error)
      setReport(data)
    } catch (err: any) {
      setReport(null)
      setError(err?.message || 'Something went wrong. Nothing was saved.')
    } finally {
      setBusy(null)
    }
  }

  const label: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }
  const done = report?.committed === true

  return (
    <div className="page-container" style={{ maxWidth: 780 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <p className="portal-page-title" style={{ margin: 0 }}>Import questions</p>
        <Link href="/play/host/questions" className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }}>Back</Link>
      </div>
      <p style={{ margin: '4px 0 16px', fontSize: 14, color: 'var(--text-secondary)' }}>
        Add many questions at once from a spreadsheet. Fill in the template in Excel or Google Sheets, save it as CSV, and upload it here. Or copy the cells and paste them.
      </p>

      {error && <p className="banner banner-danger" role="alert" style={{ marginBottom: 16 }}>{error}</p>}

      {done ? (
        <div className="card">
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--success)' }}>
            Imported {report!.imported} question{report!.imported !== 1 ? 's' : ''}
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '6px 0 0' }}>
            {status === 'draft' ? 'They are saved as drafts, so students will not see them until you approve them.' : 'They are approved and can be used in games now.'}
            {report!.duplicateCount > 0 && ` ${report!.duplicateCount} duplicate${report!.duplicateCount !== 1 ? 's were' : ' was'} skipped.`}
            {report!.errorCount > 0 && ` ${report!.errorCount} row${report!.errorCount !== 1 ? 's' : ''} had problems and ${report!.errorCount !== 1 ? 'were' : 'was'} not imported.`}
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <Link href={`/play/host/questions${status === 'draft' ? '?status=draft' : ''}`} className="btn btn-primary">{status === 'draft' ? 'Review drafts' : 'View questions'}</Link>
            <button className="btn btn-secondary" onClick={() => { setText(''); setFileName(''); setReport(null) }}>Import another file</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <div style={label}>1. Get the template</div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 10px' }}>
              One row per question. For multiple choice, fill option_a to option_f and put the correct letter (or the exact text) in correct_answer. For true or false use true or false. Points can be 1 to 5 and default to 1.
            </p>
            <a href="/api/play/host/questions/template" download className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }}>Download template (CSV)</a>
          </div>

          <div className="card">
            <div style={label}>2. Upload or paste</div>
            <input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" onChange={onFile} aria-label="Choose a CSV file" />
            {fileName && <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '6px 0 0' }}>Loaded {fileName}</p>}
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '12px 0 6px' }}>Or paste rows copied from a spreadsheet, including the header row:</p>
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setFileName(''); reset() }}
              rows={6}
              aria-label="Pasted spreadsheet rows"
              placeholder="subject	topic	type	question	option_a	option_b	..."
              style={{ width: '100%', fontFamily: 'monospace', fontSize: 12 }}
            />
          </div>

          <div className="card">
            <div style={label}>3. Save them as</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 14, textTransform: 'none', letterSpacing: 'normal' }}>
                <input type="radio" name="status" checked={status === 'draft'} onChange={() => { setStatus('draft'); reset() }} style={{ marginTop: 3 }} />
                <span><strong>Drafts</strong> (recommended). Review them first, then approve the good ones.</span>
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 14, textTransform: 'none', letterSpacing: 'normal' }}>
                <input type="radio" name="status" checked={status === 'approved'} onChange={() => { setStatus('approved'); reset() }} style={{ marginTop: 3 }} />
                <span><strong>Approved</strong>. Students can get them in games right away.</span>
              </label>
            </div>
            <div style={{ marginTop: 14 }}>
              <button onClick={() => run(false)} disabled={busy !== null || !text.trim()} className="btn btn-primary">{busy === 'check' ? 'Checking…' : 'Check file'}</button>
            </div>
          </div>

          {report && (
            <div className="card">
              <div style={label}>4. Review</div>
              <p style={{ fontSize: 15, margin: '0 0 4px' }}>
                <strong>{report.importable}</strong> of {report.total} row{report.total !== 1 ? 's' : ''} ready to import
                {report.duplicateCount > 0 && <>, <strong>{report.duplicateCount}</strong> duplicate{report.duplicateCount !== 1 ? 's' : ''} to skip</>}
                {report.errorCount > 0 && <>, <strong style={{ color: 'var(--danger)' }}>{report.errorCount}</strong> with problems</>}.
              </p>

              {report.topics.length > 0 && (
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 12px' }}>
                  {report.topics.map((t) => `${t.label} (${t.count})`).join(', ')}
                </p>
              )}

              {report.errors.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Problems to fix in the spreadsheet</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--danger)' }}>
                    {report.errors.map((e) => <li key={`e${e.row}`}>Row {e.row}: {e.message}</li>)}
                  </ul>
                  {report.errorCount > report.errors.length && <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>…and {report.errorCount - report.errors.length} more.</p>}
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '6px 0 0' }}>Rows with problems are skipped. You can import the good rows now and fix the rest later.</p>
                </div>
              )}

              {report.duplicates.length > 0 && (
                <details style={{ marginBottom: 12, fontSize: 13 }}>
                  <summary style={{ cursor: 'pointer' }}>{report.duplicateCount} duplicate row{report.duplicateCount !== 1 ? 's' : ''} will be skipped</summary>
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: 'var(--text-secondary)' }}>
                    {report.duplicates.map((d) => <li key={`d${d.row}`}>Row {d.row}</li>)}
                  </ul>
                </details>
              )}

              {report.sample.length > 0 && (
                <div style={{ overflowX: 'auto', marginBottom: 14 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '4px 8px 4px 0' }}>Row</th><th style={{ padding: 4 }}>Topic</th><th style={{ padding: 4 }}>Type</th><th style={{ padding: 4 }}>Question</th><th style={{ padding: 4 }}>Answer</th><th style={{ padding: 4 }}>Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.sample.map((s) => (
                        <tr key={s.row} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ padding: '6px 8px 6px 0' }}>{s.row}</td>
                          <td style={{ padding: 6 }}>{s.subject} · {s.topic}</td>
                          <td style={{ padding: 6 }}>{TYPE_LABELS[s.type]}</td>
                          <td style={{ padding: 6 }}>{s.question}</td>
                          <td style={{ padding: 6, fontWeight: 700 }}>{s.correctAnswer}</td>
                          <td style={{ padding: 6 }}>{s.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {report.importable > report.sample.length && <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '6px 0 0' }}>Showing the first {report.sample.length} of {report.importable}.</p>}
                </div>
              )}

              <button onClick={() => run(true)} disabled={busy !== null || report.importable === 0} className="btn btn-primary">
                {busy === 'import' ? 'Importing…' : report.importable === 0 ? 'Nothing to import' : `Import ${report.importable} question${report.importable !== 1 ? 's' : ''} as ${status === 'draft' ? 'drafts' : 'approved'}`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
