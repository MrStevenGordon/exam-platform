'use client'

import { RUBRIC_LIMITS, rubricTotal, writtenPoints, type EssayPointDraft } from '@/lib/essayRubricPure'

// The marking points for an essay: what a good answer earns marks for, and how many. Used when adding and editing a question.
export default function EssayRubricEditor({ rows, onChange, idPrefix = 'essay-point' }: { rows: EssayPointDraft[]; onChange: (rows: EssayPointDraft[]) => void; idPrefix?: string }) {
  const total = rubricTotal(writtenPoints(rows).map((r) => ({ marks: Number(r.marks) || 0 })))

  function update(i: number, patch: Partial<EssayPointDraft>) {
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }

  return (
    <div style={{ marginBottom: 16, padding: 14, background: 'var(--page-bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Marking points (optional)</div>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 10px' }}>
        What a good answer earns marks for. When you mark, you get a box for each point. They add up to the points for this question.
      </p>
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <label htmlFor={`${idPrefix}-text-${i}`} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Point {i + 1}</label>
            <input
              id={`${idPrefix}-text-${i}`}
              value={row.text}
              maxLength={RUBRIC_LIMITS.maxText}
              onChange={(e) => update(i, { text: e.target.value })}
              placeholder="e.g. Simple interest is worked out on the original amount only"
              style={{ width: '100%', marginTop: 4 }}
            />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-marks-${i}`} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Marks</label>
            <input
              id={`${idPrefix}-marks-${i}`}
              type="number"
              min={1}
              max={RUBRIC_LIMITS.maxMarksPerPoint}
              step={1}
              value={row.marks}
              onChange={(e) => update(i, { marks: e.target.value })}
              style={{ width: 70, marginTop: 4, display: 'block' }}
            />
          </div>
          <button
            type="button"
            onClick={() => onChange(rows.length > 1 ? rows.filter((_, j) => j !== i) : [{ text: '', marks: 1 }])}
            aria-label={`Remove marking point ${i + 1}`}
            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 12, marginTop: 24 }}
          >
            Remove
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {rows.length < RUBRIC_LIMITS.maxPoints && (
          <button type="button" className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => onChange([...rows, { text: '', marks: 1 }])}>+ Add a point</button>
        )}
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {total > 0 ? `Total: ${total} mark${total === 1 ? '' : 's'}. This is the points for the question.` : 'Leave these empty to mark with a single score, as before.'}
        </span>
      </div>
    </div>
  )
}
