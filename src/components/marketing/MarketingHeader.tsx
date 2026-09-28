import Link from 'next/link'
import Logo from './Logo'

// A minimal, consistent header for every public marketing/request page that isn't the homepage
// itself (which has its own fuller nav) — logo back to home, one clear way forward. Several of
// these pages (build-my-school, org/signup, find-my-school) previously had no header at all: no
// logo, no way back, nothing tying them visually to the rest of the site.
export default function MarketingHeader({ ctaHref = '/find-my-school', ctaLabel = 'Find My School' }: { ctaHref?: string; ctaLabel?: string }) {
  return (
    <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 3rem', borderBottom: '1px solid var(--border)', background: 'var(--card-bg)' }}>
      <Logo size={32} />
      <Link href={ctaHref}>
        <button className="btn btn-primary">{ctaLabel}</button>
      </Link>
    </nav>
  )
}
