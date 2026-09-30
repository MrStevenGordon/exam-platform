import Link from 'next/link'
import Logo from '@/components/marketing/Logo'

// Shared by every public marketing page. Every link here is a real page — none of this site's
// content lives only on the homepage anymore, so there's nothing to anchor-scroll to.
export default function Footer() {
  return (
    <footer style={{ padding: '2rem 3rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
      <Logo size={26} />
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Link href="/products" style={{ fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}>Products</Link>
        <Link href="/how-it-works" style={{ fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}>How it works</Link>
        <Link href="/contact" style={{ fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}>Contact</Link>
        <Link href="/download" style={{ fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}>Download App</Link>
        <Link href="/terms" style={{ fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}>Terms</Link>
        <Link href="/privacy" style={{ fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}>Privacy</Link>
        <Link href="/find-my-school" style={{ fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}>Find My School</Link>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>&copy; {new Date().getFullYear()} Smart Assess Ja &middot; All rights reserved</div>
    </footer>
  )
}
