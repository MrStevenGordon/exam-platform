import Link from 'next/link'

// The brand mark: three ascending rounded bars (growth/progress), replacing the earlier
// clipboard-check placeholder icon. Same mark at every size so the nav, footer, and any future
// use stay visually identical — only the scale changes.
function LogoMark({ badgeSize, iconSize }: { badgeSize: number; iconSize: number }) {
  return (
    <div
      className="logo-mark"
      style={{
        width: badgeSize, height: badgeSize, background: '#1A0E06', borderRadius: badgeSize * 0.27,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}
    >
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3.5" y="13" width="4.5" height="7.5" rx="1.5" fill="var(--accent)" opacity="0.5" />
        <rect x="9.75" y="8.5" width="4.5" height="12" rx="1.5" fill="var(--accent)" opacity="0.78" />
        <rect x="16" y="3.5" width="4.5" height="17" rx="1.5" fill="var(--accent)" />
      </svg>
    </div>
  )
}

// The two-tone wordmark on its own — used where the mark badge isn't wanted (rare), otherwise
// use <Logo> below, which pairs them the way they appear everywhere on the site.
export function Wordmark({ size = 16 }: { size?: number }) {
  return (
    <span className="logo-wordmark" style={{ display: 'inline-flex', alignItems: 'baseline', gap: size * 0.22, whiteSpace: 'nowrap' }}>
      <span style={{ fontFamily: "'Fraunces', serif", fontSize: size, fontWeight: 600, letterSpacing: -0.3, color: 'var(--text-primary)' }}>Smart Assess</span>
      <span style={{ fontFamily: "'Fraunces', serif", fontSize: size, fontWeight: 600, letterSpacing: -0.3, color: 'var(--accent)' }}>Ja</span>
    </span>
  )
}

// The full logo (mark + wordmark), linking home. `size` scales both proportionally — 34–38 for a
// nav bar, 24–27 for a footer or tight space.
export default function Logo({ size = 36, href = '/' }: { size?: number; href?: string }) {
  return (
    <Link href={href} style={{ display: 'flex', alignItems: 'center', gap: size * 0.29, textDecoration: 'none' }}>
      <LogoMark badgeSize={size} iconSize={size * 0.53} />
      <Wordmark size={size * 0.6} />
    </Link>
  )
}
