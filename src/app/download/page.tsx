import type { Metadata } from 'next'
import MarketingHeader from '@/components/marketing/MarketingHeader'

// Installers live in a separate, public releases-only repo — the main
// source repo is private, and GitHub Release assets on a private repo
// aren't publicly downloadable. GitHub also sanitizes filenames: spaces
// become dots.
//
// Uses GitHub's "latest" redirect rather than a version-pinned tag, so
// this page never goes stale again — it previously pointed straight at
// desktop-v0.2.4 and kept serving that exact file through several later
// releases. Artifact filenames are version-agnostic on purpose (see
// package.json's build.mac/win.artifactName) so this URL keeps resolving
// correctly no matter what version is actually latest.
const MAC_DOWNLOAD_URL = 'https://github.com/MrStevenGordon/exam-platform-releases/releases/latest/download/SmartAssess.dmg'
const WIN_DOWNLOAD_URL = 'https://github.com/MrStevenGordon/exam-platform-releases/releases/latest/download/SmartAssess-Setup.exe'

const TITLE = 'Download Smart Assess'
const DESCRIPTION = 'A native desktop app for exams, built for spotty connections. Answers autosave locally and sync automatically once you’re back online.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: 'https://smartassessja.com/download' },
  openGraph: { title: TITLE, description: DESCRIPTION, type: 'website' },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
}

// No client-side state anywhere on this page — a plain server component, which is also
// what lets it export metadata at all (a 'use client' page can't).
export default function DownloadPage() {
  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: 'var(--text-primary)' }}>
      <MarketingHeader />

      <section style={{ padding: '5rem 3rem', textAlign: 'center', background: 'var(--page-bg)' }}>
        <div style={{ display: 'inline-block', background: 'var(--accent-light)', color: 'var(--accent-dark)', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', padding: '4px 14px', borderRadius: 20, marginBottom: '1.5rem' }}>
          Desktop App
        </div>
        <h1 style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.15, margin: '0 auto 1.25rem', maxWidth: 600, letterSpacing: -0.5 }}>
          Download Smart Assess
        </h1>
        <p style={{ fontSize: 17, color: 'var(--text-secondary)', maxWidth: 520, margin: '0 auto 2.5rem', lineHeight: 1.6 }}>
          A native desktop app for exams, built for spotty connections. Answers autosave locally and sync automatically once you&apos;re back online.
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
          For students and staff at schools with an active Smart Assess subscription. Log in with your own school&apos;s account, the same as on the website.
        </p>
      </section>

      <section style={{ padding: '3rem 3rem 5rem', maxWidth: 640, margin: '0 auto' }}>
        <div className="card" style={{ padding: '1.5rem 1.75rem' }}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>Setting it up</h2>
          <ol style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.9, paddingLeft: 20, margin: 0 }}>
            <li>Download and run the installer (on Mac, drag Smart Assess into Applications).</li>
            <li>The first time you open it, your computer may warn it&apos;s from an unidentified developer. On Mac, right-click the app and choose <strong>Open</strong>; on Windows, click <strong>More info → Run anyway</strong> on the SmartScreen prompt.</li>
            <li>Log in with your own school&apos;s Smart Assess account. The app works the same as the website from there. If your school&apos;s subscription isn&apos;t active, login will say so.</li>
          </ol>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', marginTop: 20 }}>
          Don&apos;t have a subscription yet? <a href="/build-my-school" style={{ color: 'var(--accent-dark)' }}>Get your school set up</a> or <a href="/org/signup" style={{ color: 'var(--accent-dark)' }}>request an organization account</a>.
        </p>
      </section>
    </div>
  )
}
