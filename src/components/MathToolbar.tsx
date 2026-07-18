'use client'

import React from 'react'
import { toSuperscript, BUTTON_GROUPS } from './mathSymbols'

interface MathToolbarProps {
  textareaId: string
  value: string
  onChange: (val: string) => void
}

export default function MathToolbar({ textareaId, value, onChange }: MathToolbarProps) {
  const [open, setOpen] = React.useState(false)
  const [activeGroup, setActiveGroup] = React.useState('Powers')
  const [customPower, setCustomPower] = React.useState('')

  function insertAtCursor(insert: string) {
    const textarea = document.getElementById(textareaId) as HTMLTextAreaElement
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd

    const newText = value.slice(0, start) + insert + value.slice(end)
    const newCursorPos = start + insert.length

    onChange(newText)

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  return (
    <div style={{ marginBottom: 4 }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          fontSize: 12, fontWeight: 700, color: 'var(--accent-dark)',
          background: 'var(--accent-light)', border: '1px solid var(--accent)',
          borderRadius: open ? '8px 8px 0 0' : 8, padding: '4px 12px',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        ∑ Math symbols {open ? '▲' : '▼'}
      </button>

      {open && (
        <div style={{
          border: '1px solid var(--border-strong)',
          borderRadius: '0 8px 8px 8px',
          background: 'var(--page-bg)',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderBottom: '1px solid var(--border)', background: 'var(--card-bg)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>Any power:</span>
            <input
              type="text"
              value={customPower}
              onChange={(e) => setCustomPower(e.target.value)}
              placeholder="e.g. -6"
              style={{ width: 60, fontSize: 13, padding: '3px 6px' }}
            />
            <button
              type="button"
              disabled={!customPower.trim()}
              onClick={() => { insertAtCursor('×10' + toSuperscript(customPower.trim())); setCustomPower('') }}
              style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: '1px solid var(--border-strong)', background: 'white', cursor: customPower.trim() ? 'pointer' : 'default', opacity: customPower.trim() ? 1 : 0.5 }}
            >
              Insert ×10ⁿ
            </button>
            <button
              type="button"
              disabled={!customPower.trim()}
              onClick={() => { insertAtCursor(toSuperscript(customPower.trim())); setCustomPower('') }}
              style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: '1px solid var(--border-strong)', background: 'white', cursor: customPower.trim() ? 'pointer' : 'default', opacity: customPower.trim() ? 1 : 0.5 }}
            >
              Insert power only
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', borderBottom: '1px solid var(--border)', background: 'var(--card-bg)' }}>
            {BUTTON_GROUPS.map((g) => (
              <button
                key={g.label}
                type="button"
                onClick={() => setActiveGroup(g.label)}
                style={{
                  padding: '5px 10px', fontSize: 11, fontWeight: 700,
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

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 10px' }}>
            {BUTTON_GROUPS.find(g => g.label === activeGroup)?.buttons.map((btn) => (
              <button
                key={btn.label}
                type="button"
                title={btn.title}
                onClick={() => insertAtCursor(btn.insert)}
                style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: 15, fontWeight: 600,
                  border: '1px solid var(--border-strong)', background: 'var(--card-bg)',
                  color: 'var(--text-primary)', cursor: 'pointer',
                  minWidth: 36, textAlign: 'center',
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '4px 10px 8px' }}>
            Click a symbol to insert it at the cursor position
          </div>
        </div>
      )}
    </div>
  )
}
