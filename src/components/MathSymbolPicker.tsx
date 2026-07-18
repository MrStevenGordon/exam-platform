'use client'

import React, { useState, useRef, useEffect } from 'react'

const SUPERSCRIPT_MAP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '-': '⁻', '+': '⁺', '(': '⁽', ')': '⁾',
}

function toSuperscript(input: string): string {
  return input.split('').map((ch) => SUPERSCRIPT_MAP[ch] ?? ch).join('')
}

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
  const [customPower, setCustomPower] = useState('')
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
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
            <input
              type="text"
              value={customPower}
              onChange={(e) => setCustomPower(e.target.value)}
              placeholder="power e.g. -6"
              style={{ width: 80, fontSize: 12, padding: '3px 5px' }}
              onClick={(e) => e.stopPropagation()}
            />
            <button
              type="button"
              disabled={!customPower.trim()}
              onClick={() => { insertSymbol('×10' + toSuperscript(customPower.trim())); setCustomPower('') }}
              style={{ padding: '3px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600, border: '1px solid var(--border-strong)', background: 'var(--page-bg)', cursor: customPower.trim() ? 'pointer' : 'default', opacity: customPower.trim() ? 1 : 0.5 }}
            >
              ×10ⁿ
            </button>
            <button
              type="button"
              disabled={!customPower.trim()}
              onClick={() => { insertSymbol(toSuperscript(customPower.trim())); setCustomPower('') }}
              style={{ padding: '3px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600, border: '1px solid var(--border-strong)', background: 'var(--page-bg)', cursor: customPower.trim() ? 'pointer' : 'default', opacity: customPower.trim() ? 1 : 0.5 }}
            >
              ⁿ only
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
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
        </div>
      )}
    </div>
  )
}
