'use client'

import { useEffect, useRef, useState } from 'react'
import 'katex/dist/katex.min.css'
import { insertAt, latexToLinear, wrapMath } from '@/lib/mathText'

interface MathBoxButtonProps {
  // The text box the result is put into (found by id, like the symbol picker next to it).
  inputId: string
  value: string
  onChange: (val: string) => void
  // 'latex': writes \( ... \) so the text shows typeset math (question text, options, explanations).
  // 'plain': writes plain text such as 1/2 or x^2+3x, for answers that are marked by matching text.
  mode?: 'latex' | 'plain'
  label?: string
  compact?: boolean
}

// A box with a math keyboard (MathLive). Type or tap an expression, then Insert puts it at the cursor in the text box.
export default function MathBoxButton({ inputId, value, onChange, mode = 'latex', label, compact }: MathBoxButtonProps) {
  const [open, setOpen] = useState(false)
  const [latex, setLatex] = useState('')
  const [failed, setFailed] = useState(false)
  const holder = useRef<HTMLDivElement>(null)
  const field = useRef<HTMLElement & { value: string } | null>(null)
  const caret = useRef<{ start: number | null; end: number | null }>({ start: null, end: null })

  function toggle() {
    if (!open) {
      const el = document.getElementById(inputId) as HTMLInputElement | HTMLTextAreaElement | null
      caret.current = { start: el?.selectionStart ?? null, end: el?.selectionEnd ?? null }
      setLatex(''); setFailed(false)
    }
    setOpen((o) => !o)
  }

  useEffect(() => {
    if (!open || !holder.current) return
    let cancelled = false
    const host = holder.current
    import('mathlive').then(({ MathfieldElement }) => {
      if (cancelled) return
      // The KaTeX fonts are already on the page from katex.min.css, so MathLive does not need to fetch its own.
      MathfieldElement.fontsDirectory = null
      MathfieldElement.soundsDirectory = null
      const mf = new MathfieldElement()
      mf.style.width = '100%'
      mf.style.fontSize = '22px'
      mf.style.padding = '8px 10px'
      mf.style.border = '1px solid var(--border-strong)'
      mf.style.borderRadius = '8px'
      mf.style.background = 'var(--card-bg)'
      mf.style.color = 'var(--text-primary)'
      mf.addEventListener('input', () => setLatex(mf.value))
      host.innerHTML = ''
      host.appendChild(mf)
      field.current = mf as unknown as HTMLElement & { value: string }
      setTimeout(() => mf.focus(), 0)
    }).catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true; field.current = null; host.innerHTML = '' }
  }, [open])

  function insert() {
    const text = mode === 'latex' ? wrapMath(latex) : latexToLinear(latex)
    if (!text) { setOpen(false); return }
    const el = document.getElementById(inputId) as HTMLInputElement | HTMLTextAreaElement | null
    const start = caret.current.start ?? el?.selectionStart ?? null
    const end = caret.current.end ?? el?.selectionEnd ?? null
    // A plain answer box is a single answer, so the math goes in without padding.
    const result = mode === 'latex' ? insertAt(value, start, end, text) : { value: value.slice(0, start ?? value.length) + text + value.slice(end ?? start ?? value.length), caret: (start ?? value.length) + text.length }
    onChange(result.value)
    setOpen(false)
    setTimeout(() => {
      const target = document.getElementById(inputId) as HTMLInputElement | HTMLTextAreaElement | null
      if (target) { target.focus(); target.setSelectionRange(result.caret, result.caret) }
    }, 0)
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={toggle}
        title={mode === 'latex' ? 'Insert an equation with the math keyboard' : 'Type your answer with the math keyboard'}
        aria-expanded={open}
        className="sentence-case"
        style={{
          height: compact ? 28 : undefined, borderRadius: 6, fontSize: 12, fontWeight: 700, padding: compact ? '0 8px' : '4px 12px',
          border: '1px solid var(--accent)', background: 'var(--accent-light)', color: 'var(--accent-dark)', cursor: 'pointer', flexShrink: 0, textTransform: 'none',
        }}
      >
        {label ?? (compact ? 'ƒx' : 'ƒx Math box')}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Math box"
          className="sentence-case"
          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }}
          style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 100, width: 'min(380px, 86vw)', padding: 12,
            background: 'var(--card-bg)', border: '1px solid var(--border-strong)', borderRadius: 10, boxShadow: '0 6px 18px rgba(0,0,0,0.18)', textTransform: 'none',
          }}
        >
          <div ref={holder} />
          {failed && <p style={{ fontSize: 12, color: 'var(--danger)', margin: '6px 0' }}>The math box could not load. Check your connection and try again.</p>}
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '8px 0' }}>
            {mode === 'latex'
              ? 'Type with your keyboard (use / for a fraction, ^ for a power) or open the keyboard icon on the right of the box.'
              : 'Type your answer (use / for a fraction, ^ for a power) or open the keyboard icon on the right of the box.'}
          </p>
          {mode === 'plain' && latexToLinear(latex) && (
            <p style={{ fontSize: 12, margin: '0 0 8px', color: 'var(--text-primary)' }}>Your answer will read: <strong>{latexToLinear(latex)}</strong></p>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-primary sentence-case" onClick={insert} disabled={!latex.trim()} style={{ fontSize: 13, padding: '6px 14px' }}>Insert</button>
            <button type="button" className="btn btn-ghost sentence-case" onClick={() => setOpen(false)} style={{ fontSize: 13, padding: '6px 14px' }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
