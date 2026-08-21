import Link from 'next/link'

export const metadata = { title: 'IT Admin Resources | Smart Assess' }

export default function ITResourcesPage() {
  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: 'var(--text-primary)' }}>
      <nav style={{ padding: '1.25rem 3rem', borderBottom: '1px solid var(--border)', background: 'var(--card-bg)' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Smart Assess Ja</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginTop: -2 }}>Smart Assess</div>
        </Link>
      </nav>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '4rem 24px' }}>
        <div style={{ display: 'inline-block', background: 'var(--accent-light)', color: 'var(--accent-dark)', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', padding: '4px 14px', borderRadius: 20, marginBottom: '1.25rem' }}>
          For IT Administrators
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12 }}>IT Admin Resources</h1>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '2.5rem' }}>
          Tools for school IT staff managing Smart Assess on shared or lab hardware. Regular installs
          for teachers, students, and staff still go through the normal{' '}
          <Link href="/download" style={{ color: 'var(--accent-dark)', fontWeight: 600 }}>Download Smart Assess</Link> page.
          Nothing here changes that.
        </p>

        <div className="card" style={{ padding: '1.75rem' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Kiosk setup for dedicated exam lab machines</h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
            A PowerShell script for computers your school has permanently set aside as exam kiosks, nothing
            else. It locks one machine to boot straight into Smart Assess, full screen, with no desktop,
            taskbar, or Start menu reachable. It does not touch any other account on the machine, and it&apos;s
            separate from the regular app installer.
          </p>
          <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.9, paddingLeft: 20, marginBottom: 20 }}>
            <li>Requires Windows 10/11 Enterprise, Education, or IoT Enterprise, and local admin rights</li>
            <li>Run manually, once, on each dedicated kiosk machine, not for teacher or student laptops</li>
            <li>Fully reversible; instructions included</li>
          </ul>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a href="/downloads/kiosk-setup/setup-kiosk.ps1" download>
              <button className="btn btn-primary" style={{ fontSize: 14, padding: '10px 20px' }}>Download setup-kiosk.ps1</button>
            </a>
            <a href="/downloads/kiosk-setup/README.md">
              <button className="btn btn-secondary" style={{ fontSize: 14, padding: '10px 20px' }}>Read the instructions</button>
            </a>
          </div>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: '2rem' }}>
          Questions or need a hand rolling this out across a lab?{' '}
          <a href="mailto:support@smartassessja.com" style={{ color: 'var(--accent-dark)', fontWeight: 600 }}>support@smartassessja.com</a>.
        </p>
      </div>
    </div>
  )
}
