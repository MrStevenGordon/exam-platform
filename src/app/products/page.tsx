import type { Metadata } from 'next'
import SiteNav from '@/components/marketing/SiteNav'
import Footer from '@/components/marketing/Footer'
import PageCTA from '@/components/marketing/PageCTA'
import { PRODUCTS } from '@/lib/products'

const TITLE = 'Products'
const DESCRIPTION = 'Smart Assess, Smart Learning and Smart Play — three products, one sign-in. Every school starts with Smart Assess; the others switch on whenever you’re ready.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: 'https://smartassessja.com/products' },
  openGraph: { title: TITLE, description: DESCRIPTION, type: 'website' },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
}

const PRODUCT_DETAILS: Record<keyof typeof PRODUCTS, string> = {
  assess: 'Timed tests, take-home tasks and full final exams, with a review chain that matches how your department actually signs off.',
  learning: 'Teachers plan lessons on the National Standards Curriculum template, with AI-assisted drafting and a cross-school library to build on.',
  play: 'Short, game-based practice students can return to on their own, reinforcing what a lesson already covered.',
}

export default function ProductsPage() {
  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: 'var(--text-primary)' }}>
      <SiteNav />

      <section style={{ padding: '5.5rem 3rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div className="eyebrow-tag" style={{ marginBottom: 12 }}>Products</div>
          <h1 className="ecosystem-title" style={{ fontFamily: "'Fraunces', serif", textTransform: 'none', fontSize: 34, fontWeight: 500, letterSpacing: -0.5, margin: '0 0 10px' }}>Three products, one sign-in.</h1>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', maxWidth: 520, margin: '0 auto', lineHeight: 1.6 }}>
            Every school starts with Smart Assess. Smart Learning and Smart Play switch on whenever you&apos;re ready, at no extra cost to set up.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, maxWidth: 1100, margin: '0 auto' }}>
          {(Object.keys(PRODUCTS) as (keyof typeof PRODUCTS)[]).map((key) => (
            <div key={key} className="card" style={{ padding: '2rem 1.75rem' }}>
              <div style={{ width: 44, height: 44, background: 'var(--accent-light)', color: 'var(--accent-dark)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 14 }}>
                <i className={`ti ${PRODUCTS[key].icon}`} aria-hidden="true" />
              </div>
              <div style={{ fontWeight: 700, fontSize: 19 }}>{PRODUCTS[key].label}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.5, margin: '4px 0 10px' }}>{PRODUCTS[key].tagline}</div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{PRODUCT_DETAILS[key]}</div>
            </div>
          ))}
        </div>
      </section>

      <PageCTA />
      <Footer />
    </div>
  )
}
