'use client'

import { useEffect, useRef } from 'react'

interface MathRendererProps {
  text: string
  style?: React.CSSProperties
}

export default function MathRenderer({ text, style }: MathRendererProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current || !text) return

    const el = ref.current

    // Check if text has any math ($...$)
    if (!text.includes('$')) {
      el.textContent = text
      return
    }

    import('katex').then((katexModule) => {
      const katex = katexModule.default
      const parts = text.split(/(\$[^$]+\$)/)
      
      el.innerHTML = parts.map((part) => {
        if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
          const math = part.slice(1, -1)
          try {
            return katex.renderToString(math, { 
              throwOnError: false, 
              displayMode: false,
              output: 'html'
            })
          } catch {
            return `<span>${part}</span>`
          }
        }
        // Plain text - escape HTML
        return part
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
      }).join('')
    })
  }, [text])

  return (
    <div
      ref={ref}
      style={{ lineHeight: 1.6, display: 'inline', ...style }}
    />
  )
}
