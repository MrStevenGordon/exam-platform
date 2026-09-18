'use client'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

export type OptionState = 'neutral' | 'correct' | 'dim' | 'chosen' | 'wrongChosen'

// An answer option. Letter chips (not colour alone) tell the options apart,
// and the correct answer is marked with text as well as green.
export function OptionBlock({
  index,
  label,
  state,
  count,
  total,
  onClick,
  disabled,
}: {
  index: number
  label: string
  state: OptionState
  count?: number
  total?: number
  onClick?: () => void
  disabled?: boolean
}) {
  const palette: Record<OptionState, { border: string; bg: string; opacity?: number }> = {
    neutral: { border: 'var(--border-strong)', bg: 'var(--card-bg)' },
    chosen: { border: 'var(--accent)', bg: 'var(--accent-light)' },
    correct: { border: 'var(--success)', bg: 'var(--success-bg)' },
    wrongChosen: { border: 'var(--danger)', bg: 'var(--danger-bg)' },
    dim: { border: 'var(--border)', bg: 'var(--card-bg)', opacity: 0.6 },
  }
  const p = palette[state]
  const pct = total && count !== undefined && total > 0 ? Math.round((count / total) * 100) : null
  const content = (
    <>
      <span style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--accent)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>
        {LETTERS[index] ?? index + 1}
      </span>
      <span style={{ fontSize: 18, fontWeight: 600, flex: 1, textAlign: 'left' }}>{label}</span>
      {state === 'correct' && <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>Correct</span>}
      {count !== undefined && <span style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{count}{pct !== null ? ` (${pct}%)` : ''}</span>}
    </>
  )
  const style: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 'var(--radius)',
    border: `2px solid ${p.border}`, background: p.bg, opacity: p.opacity ?? 1, color: 'var(--text-primary)', width: '100%',
    font: 'inherit', minHeight: 56,
  }
  return onClick ? (
    <button onClick={onClick} disabled={disabled} style={{ ...style, cursor: disabled ? 'default' : 'pointer' }}>{content}</button>
  ) : (
    <div style={style}>{content}</div>
  )
}

export function Leaderboard({ rows, big }: { rows: { name: string; score: number; isMe: boolean }[]; big?: boolean }) {
  if (rows.length === 0) return <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>No scores yet.</p>
  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.map((r, i) => (
        <li key={`${r.name}-${i}`} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: big ? '12px 16px' : '8px 14px', borderColor: r.isMe ? 'var(--accent)' : undefined }}>
          <span style={{ width: 28, fontWeight: 800, fontSize: big ? 20 : 15, color: 'var(--text-secondary)' }}>{1 + rows.filter((x) => x.score > r.score).length}</span>
          <span style={{ flex: 1, fontWeight: 600, fontSize: big ? 20 : 15 }}>{r.name}{r.isMe ? ' (you)' : ''}</span>
          <span style={{ fontWeight: 800, fontSize: big ? 20 : 15, fontVariantNumeric: 'tabular-nums' }}>{r.score.toLocaleString()}</span>
        </li>
      ))}
    </ol>
  )
}
