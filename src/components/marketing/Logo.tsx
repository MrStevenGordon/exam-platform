import Image from 'next/image'
import Link from 'next/link'

// The brand mark: the supplied graduation-cap / open-book / checkmark artwork, cropped to just
// the icon (public/brand/logo-mark.png, transparent background, 144x131: the largest it is ever shown is 36 pixels, so a bigger file only costs data). Same mark at
// every size so the nav, footer, and any future use stay visually identical — only the scale
// changes.
function LogoMark({ size }: { size: number }) {
  const height = size * (375 / 411)
  return (
    <Image
      src="/brand/logo-mark.png"
      alt=""
      width={144}
      height={131}
      priority
      className="logo-mark"
      style={{ width: size, height, flexShrink: 0 }}
    />
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
      <LogoMark size={size} />
      <Wordmark size={size * 0.6} />
    </Link>
  )
}
