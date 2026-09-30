import Link from 'next/link'
import type { Metadata } from 'next'
import SiteNav from '@/components/marketing/SiteNav'
import Footer from '@/components/marketing/Footer'

const TITLE = 'For Organizations'
const DESCRIPTION = 'Publish a single training, certification or screening assessment with just a code and password. No student roster or school setup required.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: 'https://smartassessja.com/for-organizations' },
  openGraph: { title: TITLE, description: DESCRIPTION, type: 'website' },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
}

export default function ForOrganizationsPage() {
  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: 'var(--text-primary)' }}>
      <SiteNav />

      <section style={{ padding: '5.5rem 3rem', textAlign: 'center' }}>
        <div className="eyebrow-tag" style={{ marginBottom: 14 }}>For Organizations</div>
        <h1 className="overview-title" style={{ fontFamily: "'Fraunces', serif", textTransform: 'none', fontSize: 40, fontWeight: 500, letterSpacing: -0.6, maxWidth: 620, margin: '0 auto 16px' }}>
          One assessment. No roster required.
        </h1>
        <p style={{ fontSize: 16, color: 'var(--text-secondary)', maxWidth: 520, margin: '0 auto 3rem', lineHeight: 1.6 }}>
          Not a school? Publish a single training, certification or screening assessment and share it with a code and password — no student accounts, no class setup.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, maxWidth: 900, margin: '0 auto' }}>
          <div className="card" style={{ padding: '1.75rem', textAlign: 'left' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-light)', color: 'var(--accent-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, marginBottom: 14 }}>1</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Tell us what you need</div>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>Your organization&apos;s name and what the assessment is for — hiring, certification, or training.</p>
          </div>
          <div className="card" style={{ padding: '1.75rem', textAlign: 'left' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-light)', color: 'var(--accent-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, marginBottom: 14 }}>2</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>We set up your access</div>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>A dedicated organization account, ready to build and publish an assessment — no roster to import.</p>
          </div>
          <div className="card" style={{ padding: '1.75rem', textAlign: 'left' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-light)', color: 'var(--accent-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, marginBottom: 14 }}>3</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Publish and share it</div>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>Respondents open it with a code and password. Results and billing are in your own dashboard.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: '2.5rem' }}>
          <Link href="/org/signup" className="btn btn-primary" style={{ fontSize: 14 }}>Request Access</Link>
          <Link href="/contact" className="btn btn-secondary" style={{ fontSize: 14 }}>Have Questions? Contact Us</Link>
        </div>
      </section>

      <Footer />
    </div>
  )
}
