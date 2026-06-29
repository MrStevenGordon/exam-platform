import Link from 'next/link'

export default function SubmittedPage() {
  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
      <h1>Exam Submitted</h1>
      <p>Your answers have been recorded successfully.</p>
      <Link href="/student">
        <button style={{ padding: '10px 20px', fontSize: 16, marginTop: 16 }}>Back to My Exams</button>
      </Link>
    </div>
  )
}
