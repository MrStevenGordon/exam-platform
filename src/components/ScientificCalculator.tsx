'use client'

import { useState, useRef } from 'react'

export default function ScientificCalculator() {
  const [display, setDisplay] = useState('0')
  const [expression, setExpression] = useState('')
  const [waitingForOperand, setWaitingForOperand] = useState(false)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ x: 20, y: 80 })
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null)

  function handleDragStart(e: React.MouseEvent) {
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPosX: position.x, startPosY: position.y }
    document.onmousemove = (ev) => {
      if (!dragRef.current) return
      setPosition({
        x: dragRef.current.startPosX + ev.clientX - dragRef.current.startX,
        y: dragRef.current.startPosY + ev.clientY - dragRef.current.startY,
      })
    }
    document.onmouseup = () => { dragRef.current = null; document.onmousemove = null; document.onmouseup = null }
  }

  function inputDigit(digit: string) {
    if (waitingForOperand) {
      setDisplay(digit)
      setWaitingForOperand(false)
    } else {
      setDisplay(display === '0' ? digit : display + digit)
    }
  }

  function inputDecimal() {
    if (waitingForOperand) { setDisplay('0.'); setWaitingForOperand(false); return }
    if (!display.includes('.')) setDisplay(display + '.')
  }

  function handleOperator(op: string) {
    setExpression(display + ' ' + op + ' ')
    setWaitingForOperand(true)
  }

  function calculate() {
    try {
      const expr = expression + display
      const result = Function('"use strict"; return (' + expr.replace(/×/g, '*').replace(/÷/g, '/') + ')')()
      setDisplay(String(parseFloat(result.toFixed(10))))
      setExpression('')
      setWaitingForOperand(true)
    } catch { setDisplay('Error') }
  }

  function handleSci(fn: string) {
    const val = parseFloat(display)
    let result: number
    switch (fn) {
      case 'sin': result = Math.sin(val * Math.PI / 180); break
      case 'cos': result = Math.cos(val * Math.PI / 180); break
      case 'tan': result = Math.tan(val * Math.PI / 180); break
      case 'log': result = Math.log10(val); break
      case 'ln': result = Math.log(val); break
      case 'sqrt': result = Math.sqrt(val); break
      case 'x2': result = val * val; break
      case 'x3': result = val * val * val; break
      case '1/x': result = 1 / val; break
      case 'pi': result = Math.PI; break
      case 'e': result = Math.E; break
      case '+/-': result = -val; break
      default: result = val
    }
    setDisplay(String(parseFloat(result.toFixed(10))))
    setWaitingForOperand(true)
  }

  function clear() { setDisplay('0'); setExpression(''); setWaitingForOperand(false) }
  function backspace() {
    if (display.length > 1) setDisplay(display.slice(0, -1))
    else setDisplay('0')
  }

  const btnStyle = (color = 'var(--card-bg)', textColor = 'var(--text-primary)') => ({
    padding: '9px 2px', borderRadius: 6, border: '1px solid var(--border)',
    background: color, color: textColor, cursor: 'pointer', fontSize: 13, fontWeight: 600,
    width: '100%', textAlign: 'center' as const, minHeight: 36,
  })

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: 'fixed', bottom: 80, left: 20, zIndex: 500,
          background: 'var(--accent)', color: 'white', border: 'none',
          borderRadius: '50%', width: 48, height: 48, fontSize: 20,
          cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        title="Scientific calculator"
      >
        🧮
      </button>

      {open && (
        <div
          style={{
            position: 'fixed', left: position.x, top: position.y, zIndex: 600,
            background: 'var(--card-bg)', borderRadius: 12, padding: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)', width: 280,
            border: '1px solid var(--border)',
          }}
        >
          {/* Header — draggable */}
          <div
            onMouseDown={handleDragStart}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, cursor: 'move', userSelect: 'none' }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>Scientific Calculator</span>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-muted)' }}>✕</button>
          </div>

          {/* Display */}
          <div style={{ background: '#1A0E06', borderRadius: 8, padding: '8px 12px', marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', minHeight: 16 }}>{expression}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'white', textAlign: 'right', wordBreak: 'break-all' }}>{display}</div>
          </div>

          {/* Scientific row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 3, marginBottom: 4 }}>
            {[['sin','sin'],['cos','cos'],['tan','tan'],['log','log'],['ln','ln']].map(([label, fn]) => (
              <button key={fn} onClick={() => handleSci(fn)} style={btnStyle('var(--accent-light)', 'var(--accent-dark)')}>{label}</button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 3, marginBottom: 4 }}>
            {[['√','sqrt'],['x²','x2'],['x³','x3'],['1/x','1/x'],['π','pi']].map(([label, fn]) => (
              <button key={fn} onClick={() => handleSci(fn)} style={btnStyle('var(--accent-light)', 'var(--accent-dark)')}>{label}</button>
            ))}
          </div>

          {/* Main grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
            <button onClick={clear} style={btnStyle('var(--danger-bg)', 'var(--danger)')}>C</button>
            <button onClick={() => handleSci('+/-')} style={btnStyle('var(--page-bg)')}>+/-</button>
            <button onClick={backspace} style={btnStyle('var(--page-bg)')}>⌫</button>
            <button onClick={() => handleOperator('÷')} style={btnStyle('var(--accent)', 'white')}>÷</button>

            {['7','8','9'].map(d => <button key={d} onClick={() => inputDigit(d)} style={btnStyle()}>{d}</button>)}
            <button onClick={() => handleOperator('×')} style={btnStyle('var(--accent)', 'white')}>×</button>

            {['4','5','6'].map(d => <button key={d} onClick={() => inputDigit(d)} style={btnStyle()}>{d}</button>)}
            <button onClick={() => handleOperator('-')} style={btnStyle('var(--accent)', 'white')}>−</button>

            {['1','2','3'].map(d => <button key={d} onClick={() => inputDigit(d)} style={btnStyle()}>{d}</button>)}
            <button onClick={() => handleOperator('+')} style={btnStyle('var(--accent)', 'white')}>+</button>

            <button onClick={() => handleSci('e')} style={btnStyle()}>e</button>
            <button onClick={() => inputDigit('0')} style={btnStyle()}>0</button>
            <button onClick={inputDecimal} style={btnStyle()}>.</button>
            <button onClick={calculate} style={btnStyle('#1A0E06', 'white')}>=</button>
          </div>
        </div>
      )}
    </>
  )
}
