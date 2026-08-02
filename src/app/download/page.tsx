'use client'

import Link from 'next/link'

// GitHub sanitizes release asset filenames — spaces become dots.
const MAC_DOWNLOAD_URL = 'https://github.com/MrStevenGordon/exam-platform/releases/download/desktop-v0.1.0/Smart.Assess-0.1.0.dmg'
const WIN_DOWNLOAD_URL = 'https://github.com/MrStevenGordon/exam-platform/releases/download/desktop-v0.1.0/Smart.Assess.Setup.0.1.0.exe'

export default function DownloadPage() {
  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: 'var(--text-primary)' }}>
      <nav className="site-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 3rem', borderBottom: '1px solid var(--border)', background: 'var(--card-bg)', position: 'sticky', top: 0, zIndex: 100 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{ width: 32, height: 32, background: 'var(--accent)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📝</div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Smart Assess Ja</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginTop: -2 }}>Smart Assess</div>
          </div>
        </Link>
        <Link href="/login">
          <button className="btn btn-primary">Log in</button>
        </Link>
      </nav>

      <section style={{ padding: '5rem 3rem', textAlign: 'center', background: 'var(--page-bg)' }}>
        <div style={{ display: 'inline-block', background: 'var(--accent-light)', color: 'var(--accent-dark)', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', padding: '4px 14px', borderRadius: 20, marginBottom: '1.5rem' }}>
          Desktop App
        </div>
        <h1 style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.15, margin: '0 auto 1.25rem', maxWidth: 600, letterSpacing: -0.5 }}>
          Download Smart Assess
        </h1>
        <p style={{ fontSize: 17, color: 'var(--text-secondary)', maxWidth: 520, margin: '0 auto 2.5rem', lineHeight: 1.6 }}>
          A native desktop app for exams, built for spotty connections — answers autosave locally and sync automatically once you&apos;re back online.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <a href={MAC_DOWNLOAD_URL}>
            <button className="btn btn-primary" style={{ fontSize: 15, padding: '14px 32px' }}>Download for Mac</button>
          </a>
          <a href={WIN_DOWNLOAD_URL}>
            <button className="btn btn-secondary" style={{ fontSize: 15, padding: '14px 32px' }}>Download for Windows</button>
          </a>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Schools and organizations only — you&apos;ll need a subscription license key to activate it after installing.
        </p>
      </section>

      <section style={{ padding: '3rem 3rem 5rem', maxWidth: 640, margin: '0 auto' }}>
        <div className="card" style={{ padding: '1.5rem 1.75rem' }}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>Setting it up</h2>
          <ol style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.9, paddingLeft: 20, margin: 0 }}>
            <li>Download and run the installer (on Mac, drag Smart Assess into Applications).</li>
            <li>The first time you open it, your computer may warn it&apos;s from an unidentified developer — on Mac, right-click the app and choose <strong>Open</strong>; on Windows, click <strong>More info → Run anyway</strong> on the SmartScreen prompt.</li>
            <li>On first launch, enter the license key emailed to your school or organization to activate it.</li>
            <li>Log in with your normal Smart Assess account — the app works the same as the website from there.</li>
          </ol>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', marginTop: 20 }}>
          Don&apos;t have a subscription yet? <a href="/build-my-school" style={{ color: 'var(--accent-dark)' }}>Get your school set up</a> or <a href="/org/signup" style={{ color: 'var(--accent-dark)' }}>sign up as an organization</a>.
        </p>
      </section>
    </div>
  )
}
