import Link from 'next/link'

// A minimal, consistent header for every public marketing/request page that isn't the homepage
// itself (which has its own fuller nav) — logo back to home, one clear way forward. Several of
// these pages (build-my-school, org/signup, find-my-school) previously had no header at all: no
// logo, no way back, nothing tying them visually to the rest of the site.
export default function MarketingHeader({ ctaHref = '/find-my-school', ctaLabel = 'Find My School' }: { ctaHref?: string; ctaLabel?: string }) {
  return (
    <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 3rem', borderBottom: '1px solid var(--border)', background: 'var(--card-bg)' }}>
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
        <div style={{ width: 32, height: 32, background: 'var(--accent)', color: 'white', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
          <i className="ti ti-clipboard-check" aria-hidden="true" />
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Smart Assess Ja</div>
      </Link>
      <Link href={ctaHref}>
        <button className="btn btn-primary">{ctaLabel}</button>
      </Link>
    </nav>
  )
}
