import Link from 'next/link'
import SiteNav from '@/components/marketing/SiteNav'
import Footer from '@/components/marketing/Footer'

// The homepage is the hero only — every other section (the problem, how it works, products, who
// it's for, contact) now lives on its own dedicated page, linked from the nav above and the
// footer below, rather than all being stacked into one long scroll.
export default function HomePage() {
  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: 'var(--text-primary)' }}>
      <SiteNav />

      <section id="home" style={{ padding: '5.5rem 3rem 6rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4rem' }}>
        <div style={{ flex: '1 1 480px', display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 560 }}>
          <div className="eyebrow-tag">Learn &middot; Assess &middot; Play</div>
          <h1 className="hero-title" style={{ fontFamily: "'Fraunces', serif", textTransform: 'none', fontSize: 62, fontWeight: 600, lineHeight: 1.08, letterSpacing: -1.2, color: 'var(--text-primary)', margin: 0 }}>
            Smarter Assessments.<br />Better Learning.
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0 }}>
            A connected platform for schools and organizations across Jamaica, bringing exams, lessons and practice into one place, built around how your school actually works.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/build-my-school">
              <button className="btn btn-primary" style={{ fontSize: 15, padding: '14px 30px' }}>Request a Demo</button>
            </Link>
            <Link href="/find-my-school">
              <button className="btn btn-secondary" style={{ fontSize: 15, padding: '14px 30px' }}>Find My School</button>
            </Link>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Free to request, no commitment. We&apos;ll walk you through the platform personally.</p>
        </div>

        {/* Illustrative interface composition — not a real screenshot */}
        <div style={{ flex: '1 1 380px', maxWidth: 460, margin: '0 auto' }}>
          <div className="card" style={{ borderRadius: 18, padding: 22, boxShadow: '0 24px 48px -18px rgba(30,18,8,0.16)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Form 4 &middot; Mathematics</div>
              <span className="badge" style={{ background: 'var(--accent-light)', color: 'var(--accent-dark)' }}>Live</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {[70, 60, 80].map((w, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 11, background: 'var(--page-bg)', border: '1px solid var(--border)', borderRadius: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--accent-light)', flexShrink: 0 }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ height: 7, width: `${w}%`, background: '#EDE0CD', borderRadius: 4 }} />
                    <div style={{ height: 5, width: `${w * 0.6}%`, background: '#F3E9DA', borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: '#1A0E06', borderRadius: 18, padding: 20, marginTop: -34, marginLeft: '20%', width: '75%', boxShadow: '0 24px 48px -18px rgba(30,18,8,0.3)', position: 'relative' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 }}>Class average</div>
            <div style={{ fontFamily: "'Fraunces', serif", textTransform: 'none', fontSize: 34, fontWeight: 600, color: 'white', marginBottom: 12 }}>78<span style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)' }}>%</span></div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 40 }}>
              {[55, 70, 45, 90, 65, 80].map((h, i) => (
                <div key={i} style={{ flex: 1, height: `${h}%`, background: i === 3 ? 'var(--accent)' : 'rgba(212,118,42,0.45)', borderRadius: '3px 3px 0 0' }} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
