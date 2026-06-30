import Link from 'next/link'

export default function SubmittedPage() {
  return (
    <div className="page-container" style={{ maxWidth: 480, textAlign: 'center' }}>
      <div className="card" style={{ background: 'var(--success-bg)' }}>
        <h1 style={{ color: 'var(--success)' }}>Exam submitted</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>Your answers have been recorded.</p>
        <Link href="/student">
          <button className="btn btn-primary" style={{ marginTop: 16 }}>Back to my exams</button>
        </Link>
      </div>
    </div>
  )
}
