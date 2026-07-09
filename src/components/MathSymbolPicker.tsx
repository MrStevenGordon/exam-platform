'use client'

import React, { useState, useRef, useEffect } from 'react'

const QUICK_SYMBOLS = [
  '²', '³', '⁴', '⁻¹', '⁻²', '√', '∛',
  '×', '÷', '±', '≤', '≥', '≠', '≈',
  'π', 'θ', '°', '∠', '∥', '⊥',
  '∪', '∩', '∈', '∉', '⊂',
  '℃', '℉', '$', '₁', '₂',
  '× 10⁻⁵', '× 10⁵', '× 10⁻³', '× 10³',
]

interface MathSymbolPickerProps {
  inputId: string
  value: string
  onChange: (val: string) => void
}

export default function MathSymbolPicker({ inputId, value, onChange }: MathSymbolPickerProps) {
  const [open, setOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function insertSymbol(symbol: string) {
    const input = document.getElementById(inputId) as HTMLInputElement | HTMLTextAreaElement
    if (!input) {
      onChange(value + symbol)
      setOpen(false)
      return
    }

    const start = input.selectionStart || 0
    const end = input.selectionEnd || 0
    const newVal = value.slice(0, start) + symbol + value.slice(end)
    const newPos = start + symbol.length

    onChange(newVal)
    setOpen(false)

    setTimeout(() => {
      input.focus()
      input.setSelectionRange(newPos, newPos)
    }, 0)
  }

  return (
    <div ref={pickerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title="Insert math symbol"
        style={{
          width: 28, height: 28, borderRadius: 6, fontSize: 13, fontWeight: 700,
          border: '1px solid var(--border-strong)', background: 'var(--accent-light)',
          color: 'var(--accent-dark)', cursor: 'pointer', flexShrink: 0,
        }}
      >
        ∑
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 32, left: 0, zIndex: 100,
          background: 'var(--card-bg)', border: '1px solid var(--border-strong)',
          borderRadius: 8, padding: 8, width: 260,
          display: 'flex', flexWrap: 'wrap', gap: 4,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          {QUICK_SYMBOLS.map((sym) => (
            <button
              key={sym}
              type="button"
              onClick={() => insertSymbol(sym)}
              style={{
                padding: '3px 6px', borderRadius: 4, fontSize: 14,
                border: '1px solid var(--border)', background: 'var(--page-bg)',
                color: 'var(--text-primary)', cursor: 'pointer',
                minWidth: 32, textAlign: 'center',
              }}
            >
              {sym}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
