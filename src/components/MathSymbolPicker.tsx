'use client'

import React, { useState, useRef, useEffect } from 'react'
import { toSuperscript, BUTTON_GROUPS } from './mathSymbols'

interface MathSymbolPickerProps {
  inputId: string
  value: string
  onChange: (val: string) => void
}

export default function MathSymbolPicker({ inputId, value, onChange }: MathSymbolPickerProps) {
  const [open, setOpen] = useState(false)
  const [activeGroup, setActiveGroup] = useState('Powers')
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
      return
    }

    const start = input.selectionStart || 0
    const end = input.selectionEnd || 0
    const newVal = value.slice(0, start) + symbol + value.slice(end)
    const newPos = start + symbol.length

    onChange(newVal)

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
          borderRadius: 8, width: 300,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 10px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>Any power:</span>
            <input
              type="text"
              value={customPower}
              onChange={(e) => setCustomPower(e.target.value)}
              placeholder="e.g. -6"
              style={{ width: 60, fontSize: 12, padding: '3px 5px' }}
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

          <div style={{ display: 'flex', flexWrap: 'wrap', borderBottom: '1px solid var(--border)', background: 'var(--page-bg)' }}>
            {BUTTON_GROUPS.map((g) => (
              <button
                key={g.label}
                type="button"
                onClick={() => setActiveGroup(g.label)}
                style={{
                  padding: '4px 8px', fontSize: 10, fontWeight: 700,
                  border: 'none', cursor: 'pointer',
                  background: activeGroup === g.label ? 'var(--accent-light)' : 'transparent',
                  color: activeGroup === g.label ? 'var(--accent-dark)' : 'var(--text-secondary)',
                  borderBottom: activeGroup === g.label ? '2px solid var(--accent)' : '2px solid transparent',
                }}
              >
                {g.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: 8 }}>
            {BUTTON_GROUPS.find(g => g.label === activeGroup)?.buttons.map((btn) => (
              <button
                key={btn.label}
                type="button"
                title={btn.title}
                onClick={() => insertSymbol(btn.insert)}
                style={{
                  padding: '3px 6px', borderRadius: 4, fontSize: 14,
                  border: '1px solid var(--border)', background: 'var(--page-bg)',
                  color: 'var(--text-primary)', cursor: 'pointer',
                  minWidth: 32, textAlign: 'center',
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
