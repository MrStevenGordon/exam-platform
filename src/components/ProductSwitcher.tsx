'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PRODUCTS, currentProduct, getEnabledProducts, productHref, type ProductKey } from '@/lib/products'

// A small menu in the sidebar header for moving between Smart Assess, Smart Learning
// and Smart Play. It only appears when the school has more than one product switched
// on, so a school using Smart Assess alone sees no change at all.
export default function ProductSwitcher({ role }: { role: string | undefined }) {
  const pathname = usePathname()
  const [products, setProducts] = useState<ProductKey[]>(['assess'])
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => { getEnabledProducts().then(setProducts) }, [])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [open])

  if (products.length < 2) return null
  const now = currentProduct(pathname)

  return (
    <div ref={box} style={{ position: 'relative', marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.06)', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}
      >
        <i className={`ti ${PRODUCTS[now].icon}`} aria-hidden="true" style={{ fontSize: 15 }} />
        <span style={{ flex: 1 }}>{PRODUCTS[now].label}</span>
        <i className={`ti ti-chevron-${open ? 'up' : 'down'}`} aria-hidden="true" style={{ fontSize: 14 }} />
      </button>
      {open && (
        <div role="menu" style={{ position: 'absolute', left: 0, right: 0, top: 'calc(100% + 4px)', zIndex: 50, background: '#2a1d14', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 8, padding: 4 }}>
          {products.map((p) => (
            <Link
              key={p}
              href={productHref(p, role)}
              role="menuitem"
              onClick={() => setOpen(false)}
              style={{ display: 'block', padding: '8px 10px', borderRadius: 6, textDecoration: 'none', background: p === now ? 'rgba(212,118,42,0.25)' : 'transparent', color: p === now ? '#FAC882' : 'rgba(255,255,255,0.85)' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
                <i className={`ti ${PRODUCTS[p].icon}`} aria-hidden="true" style={{ fontSize: 16 }} />{PRODUCTS[p].label}
                {p === now && <i className="ti ti-check" aria-label="Current" style={{ marginLeft: 'auto', fontSize: 14 }} />}
              </span>
              <span style={{ display: 'block', fontSize: 11, opacity: 0.65, marginLeft: 24 }}>{PRODUCTS[p].tagline}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
