'use client'

import React from 'react'

const MATH_BUTTONS = [
  // Superscripts
  { label: 'x²', insert: '²', title: 'Squared' },
  { label: 'x³', insert: '³', title: 'Cubed' },
  { label: 'x⁴', insert: '⁴', title: 'Power 4' },
  { label: 'xⁿ', insert: 'ⁿ', title: 'Power n' },
  { label: 'x⁻¹', insert: '⁻¹', title: 'Power -1' },
  { label: 'x⁻²', insert: '⁻²', title: 'Power -2' },
  // Roots
  { label: '√', insert: '√', title: 'Square root' },
  { label: '∛', insert: '∛', title: 'Cube root' },
  // Fractions - separator
  { label: '/', insert: '/', title: 'Fraction' },
  // Operations
  { label: '×', insert: '×', title: 'Multiply' },
  { label: '÷', insert: '÷', title: 'Divide' },
  { label: '±', insert: '±', title: 'Plus/minus' },
  // Comparisons
  { label: '≠', insert: '≠', title: 'Not equal' },
  { label: '≤', insert: '≤', title: 'Less than or equal' },
  { label: '≥', insert: '≥', title: 'Greater than or equal' },
  { label: '≈', insert: '≈', title: 'Approximately' },
  { label: '<', insert: '<', title: 'Less than' },
  { label: '>', insert: '>', title: 'Greater than' },
  // Greek
  { label: 'π', insert: 'π', title: 'Pi' },
  { label: 'θ', insert: 'θ', title: 'Theta' },
  { label: 'α', insert: 'α', title: 'Alpha' },
  { label: 'β', insert: 'β', title: 'Beta' },
  // Number notation
  { label: '10⁻⁵', insert: '× 10⁻⁵', title: 'Standard form ×10⁻⁵' },
  { label: '10⁵', insert: '× 10⁵', title: 'Standard form ×10⁵' },
  // Subscripts
  { label: 'x₁', insert: '₁', title: 'Subscript 1' },
  { label: 'x₂', insert: '₂', title: 'Subscript 2' },
  // Geometry
  { label: '°', insert: '°', title: 'Degrees' },
  { label: '∠', insert: '∠', title: 'Angle' },
  { label: '△', insert: '△', title: 'Triangle' },
  { label: '∥', insert: '∥', title: 'Parallel' },
  { label: '⊥', insert: '⊥', title: 'Perpendicular' },
  // Sets
  { label: '∈', insert: '∈', title: 'Element of' },
  { label: '∉', insert: '∉', title: 'Not element of' },
  { label: '∪', insert: '∪', title: 'Union' },
  { label: '∩', insert: '∩', title: 'Intersection' },
  { label: '⊂', insert: '⊂', title: 'Subset' },
  { label: 'U', insert: 'U = {}', title: 'Universal set' },
  // Currency
  { label: '$', insert: '$', title: 'Dollar' },
  // Temperature
  { label: '℃', insert: '℃', title: 'Celsius' },
  { label: '℉', insert: '℉', title: 'Fahrenheit' },
]

const BUTTON_GROUPS = [
  { label: 'Powers', buttons: MATH_BUTTONS.slice(0, 6) },
  { label: 'Roots & Ops', buttons: MATH_BUTTONS.slice(6, 12) },
  { label: 'Compare', buttons: MATH_BUTTONS.slice(12, 18) },
  { label: 'Greek', buttons: MATH_BUTTONS.slice(18, 22) },
  { label: 'Notation', buttons: MATH_BUTTONS.slice(22, 26) },
  { label: 'Geometry', buttons: MATH_BUTTONS.slice(26, 31) },
  { label: 'Sets', buttons: MATH_BUTTONS.slice(31, 37) },
  { label: 'Other', buttons: MATH_BUTTONS.slice(37) },
]

interface MathToolbarProps {
  textareaId: string
  value: string
  onChange: (val: string) => void
}

export default function MathToolbar({ textareaId, value, onChange }: MathToolbarProps) {
  const [open, setOpen] = React.useState(false)
  const [activeGroup, setActiveGroup] = React.useState('Powers')

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
          {/* Group tabs */}
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

          {/* Buttons for active group */}
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
