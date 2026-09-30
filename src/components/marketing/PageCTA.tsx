import Link from 'next/link'

// The closing call-to-action repeated at the bottom of every dedicated marketing page — same
// copy and destinations everywhere, so it's one component instead of four near-identical copies.
export default function PageCTA({ heading = 'Ready to rethink assessment?' }: { heading?: string }) {
  return (
    <section style={{ padding: '4.5rem 3rem', background: 'var(--accent-light)', textAlign: 'center' }}>
      <h2 className="cta-title" style={{ fontFamily: "'Fraunces', serif", textTransform: 'none', fontSize: 40, fontWeight: 500, letterSpacing: -0.6, maxWidth: 560, margin: '0 auto 22px' }}>{heading}</h2>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link href="/build-my-school">
          <button className="btn btn-dark" style={{ fontSize: 15, padding: '14px 30px' }}>Request a Demo</button>
        </Link>
        <Link href="/find-my-school">
          <button className="btn btn-secondary" style={{ fontSize: 15, padding: '14px 30px' }}>Find My School</button>
        </Link>
      </div>
    </section>
  )
}
