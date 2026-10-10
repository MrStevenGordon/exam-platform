'use client'

import { useEffect, useMemo, useState } from 'react'
import 'katex/dist/katex.min.css'
import { splitMathText } from '@/lib/mathText'
import { katexIfLoaded, loadKatex, renderMathHtml } from '@/lib/katexLoader'

interface MathTextProps {
  text: string | null | undefined
  style?: React.CSSProperties
  className?: string
}

// Shows question, option and explanation text with any math typeset. Text with no math is shown as it is, and
// dollar amounts such as "$400" are never treated as math. Safe to use anywhere a plain string was shown.
export default function MathText({ text, style, className }: MathTextProps) {
  const segments = useMemo(() => splitMathText(text), [text])
  const needsMath = segments.some((s) => s.kind === 'math')
  const [katex, setKatex] = useState(() => katexIfLoaded())

  useEffect(() => {
    if (!needsMath || katex) return
    let live = true
    loadKatex().then((k) => { if (live) setKatex(() => k) }).catch(() => {})
    return () => { live = false }
  }, [needsMath, katex])

  if (!needsMath) {
    return <span className={className} style={style}>{segments.map((s) => (s.kind === 'text' ? s.text : '')).join('')}</span>
  }

  return (
    <span className={className} style={style}>
      {segments.map((seg, i) => {
        if (seg.kind === 'text') return <span key={i}>{seg.text}</span>
        if (!katex) return <span key={i}>{seg.latex}</span>
        let html = ''
        try { html = renderMathHtml(katex, seg.latex, seg.display) } catch { html = '' }
        if (!html) return <span key={i}>{seg.latex}</span>
        return <span key={i} style={seg.display ? { display: 'block', margin: '6px 0', overflowX: 'auto' } : undefined} dangerouslySetInnerHTML={{ __html: html }} />
      })}
    </span>
  )
}
