import type { Metadata } from 'next'
import SiteNav from '@/components/marketing/SiteNav'
import Footer from '@/components/marketing/Footer'
import PageCTA from '@/components/marketing/PageCTA'

const TITLE = 'How It Works'
const DESCRIPTION = 'From assessment to action: build exams and lessons, deliver them securely on the web or desktop, analyze results down to the question, then act on them in Smart Learning and Smart Play.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: 'https://smartassessja.com/how-it-works' },
  openGraph: { title: TITLE, description: DESCRIPTION, type: 'website' },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
}

const IDEA_STEPS = [
  { n: '01', title: 'Create', icon: 'ti-pencil', desc: 'Build exams and lesson plans from a shared question bank, with AI-assisted drafting and real math notation.' },
  { n: '02', title: 'Deliver', icon: 'ti-send-2', desc: 'Run tests, tasks and full exams in a secure, proctored environment, on the web or the desktop app.' },
  { n: '03', title: 'Analyze', icon: 'ti-chart-bar', desc: 'See exactly where each class and student stands, down to the individual question.' },
  { n: '04', title: 'Act', icon: 'ti-target-arrow', desc: 'Turn results into targeted lessons in Smart Learning and follow-up practice in Smart Play.' },
]

export default function HowItWorksPage() {
  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: 'var(--text-primary)' }}>
      <SiteNav />

      {/* The problem */}
      <section style={{ padding: '5.5rem 3rem 4.5rem', textAlign: 'center' }}>
        <div className="eyebrow-tag" style={{ marginBottom: 16 }}>The problem</div>
        <h1 className="problem-title" style={{ fontFamily: "'Fraunces', serif", textTransform: 'none', fontSize: 38, fontWeight: 500, letterSpacing: -0.5, maxWidth: 720, margin: '0 auto 16px' }}>Assessment shouldn&apos;t stop at a grade.</h1>
        <p style={{ fontSize: 16, color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>A score alone doesn&apos;t tell a teacher what to do next. The result should point straight back to the lesson, the practice, and the students who need it.</p>
      </section>

      {/* The idea */}
      <section style={{ padding: '4.5rem 3rem', background: 'var(--card-bg)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div className="eyebrow-tag" style={{ marginBottom: 12 }}>The idea</div>
          <h2 className="idea-title" style={{ fontFamily: "'Fraunces', serif", textTransform: 'none', fontSize: 34, fontWeight: 500, letterSpacing: -0.5, margin: 0 }}>From assessment to action.</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 32, maxWidth: 1100, margin: '0 auto' }}>
          {IDEA_STEPS.map((step) => (
            <div key={step.n} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: 13, background: 'var(--accent-light)', color: 'var(--accent-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21 }}>
                <i className={`ti ${step.icon}`} aria-hidden="true" />
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1 }}>{step.n}</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{step.title}</div>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* The platform */}
      <section style={{ padding: '5.5rem 3rem', background: '#1A0E06' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div className="eyebrow-tag" style={{ color: '#E8A868', marginBottom: 12 }}>The platform</div>
          <h2 className="platform-title" style={{ fontFamily: "'Fraunces', serif", textTransform: 'none', fontSize: 34, fontWeight: 500, color: 'white', letterSpacing: -0.5, margin: '0 0 10px' }}>One place, not five different logins.</h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>Available on the web and as a dedicated desktop app, built to keep working through a dropped connection.</p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ flex: '1.2 1 360px', background: '#241505', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: 26, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>Mid-Term Exam: Biology</div>
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: 1 }}>QUESTION 4 OF 20</div>
              <div style={{ height: 9, width: '90%', background: 'rgba(255,255,255,0.15)', borderRadius: 4 }} />
              <div style={{ height: 9, width: '70%', background: 'rgba(255,255,255,0.15)', borderRadius: 4 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', border: '1.5px solid var(--accent)', borderRadius: 8, background: 'rgba(212,118,42,0.12)' }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1.5px solid var(--accent)', flexShrink: 0 }} />
                  <div style={{ height: 6, width: '55%', background: 'rgba(255,255,255,0.35)', borderRadius: 4 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.25)', flexShrink: 0 }} />
                  <div style={{ height: 6, width: '40%', background: 'rgba(255,255,255,0.15)', borderRadius: 4 }} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>Autosaved &middot; offline-ready</span>
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>18:42 remaining</span>
            </div>
          </div>
          <div style={{ flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ background: '#241505', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: 22 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Graded &amp; released</div>
              <div style={{ fontFamily: "'Fraunces', serif", textTransform: 'none', fontSize: 30, fontWeight: 600, color: 'white' }}>142<span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}> submissions</span></div>
            </div>
            <div style={{ background: '#241505', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: 22, display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase' }}>Strand breakdown</div>
              {[['Genetics', 84, false], ['Ecology', 61, false], ['Cell biology', 38, true]].map(([label, pct, gold]) => (
                <div key={label as string} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{ width: 82, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{label}</div>
                  <div style={{ flex: 1, height: 7, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: gold ? '#E8A868' : 'var(--accent)' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <PageCTA />
      <Footer />
    </div>
  )
}
