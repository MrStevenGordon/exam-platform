'use client'

import { checkFirst, type MarkingPoint, type Suggestion } from '@/lib/essayMarkingPure'
import type { Usage } from '@/lib/essayMarking'

// The AI's suggested marks for one essay, shown beside the answer. It only ever shows and offers: "Use these marks" copies the
// suggestion into the teacher's own mark boxes and nothing is saved until the teacher saves. Used on Grade essays and on the
// single-student review page.

const pill = (text: string, tone: 'ok' | 'check') => (
  <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, borderRadius: 100, padding: '3px 9px', marginLeft: 6, background: tone === 'ok' ? 'var(--success-bg)' : 'var(--warning-bg)', color: tone === 'ok' ? 'var(--success)' : 'var(--warning)' }}>{text}</span>
)

export type PanelProps = {
  points: MarkingPoint[]
  suggestion: Suggestion | null
  busy: boolean
  error: string | null
  onSuggest: () => void
  onRegenerate: () => void
  onUse: (marks: number[]) => void
  usage?: Usage | null
  useLabel?: string
}

export default function AiSuggestionPanel({ points, suggestion, busy, error, onSuggest, onRegenerate, onUse, usage, useLabel = 'Use these marks' }: PanelProps) {
  if (busy) {
    return <div role="status" aria-live="polite" style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-secondary)' }}>Asking the AI for suggested marks…</div>
  }

  if (!suggestion) {
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }} onClick={onSuggest}>Suggest marks</button>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>The AI proposes marks against your marking points. You decide.</span>
          {usage && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{usage.remaining} of {usage.limit} left this month</span>}
        </div>
        {error && <p role="alert" className="banner banner-danger" style={{ margin: '8px 0 0', fontSize: 13 }}>{error}</p>}
      </div>
    )
  }

  const ordered = checkFirst(suggestion.points)
  const toCheck = suggestion.points.filter((p) => p.confidence === 'check').length
  return (
    <section aria-label="AI suggested marks" style={{ marginBottom: 14, border: '1px solid #BFE0DC', background: '#F0F9F8', borderRadius: 10, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', background: '#1F8A84', color: '#fff', borderRadius: 100, padding: '3px 9px' }}>AI suggestion</span>
        <span style={{ fontSize: 13, fontWeight: 700 }}>You decide. Nothing is saved until you save your marks.</span>
      </div>

      {suggestion.addressesMarker && (
        <p role="alert" className="banner banner-danger" style={{ margin: '10px 0 0', fontSize: 13 }}>
          This answer tries to give instructions to the marker. The AI ignored them. Please read the answer yourself before using these marks.
        </p>
      )}
      {suggestion.adjusted && !suggestion.addressesMarker && (
        <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--warning)' }}>Part of the AI&rsquo;s reply was corrected automatically, for example a mark outside the allowed range or a quote that is not in the essay. Look at the points marked Check.</p>
      )}

      <div style={{ marginTop: 8 }}>
        {ordered.map((p) => (
          <div key={p.index} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '9px 0', borderTop: '1px solid #CFE6E3' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13 }}><strong>Point {p.index}.</strong> {points[p.index - 1]?.text}</div>
              {p.evidence
                ? <div style={{ fontSize: 12, color: '#4A6A67', fontStyle: 'italic', marginTop: 3 }}>&ldquo;{p.evidence}&rdquo;</div>
                : <div style={{ fontSize: 12, color: '#4A6A67', marginTop: 3 }}>{p.marks === 0 ? 'Nothing in the answer earns this point.' : 'No quote found for this point.'}</div>}
              {p.note && <div style={{ fontSize: 12, color: '#4A6A67', marginTop: 2 }}>{p.note}</div>}
            </div>
            <div style={{ whiteSpace: 'nowrap', fontSize: 14 }}>
              <strong>{p.marks}</strong> of {p.max}
              {p.confidence === 'clear' ? pill('Clear', 'ok') : pill('Check', 'check')}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderTop: '1px solid #CFE6E3', paddingTop: 10 }}>
        <span style={{ fontSize: 14 }}><strong>Suggested total: {suggestion.total} of {suggestion.max}</strong></span>
        {toCheck > 0 && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{toCheck} point{toCheck === 1 ? '' : 's'} to check, shown first.</span>}
        <span style={{ flex: 1 }} />
        <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={onRegenerate}>Suggest again</button>
        <button type="button" className="btn btn-secondary" onClick={() => onUse(suggestion.points.map((p) => p.marks))}>{useLabel}</button>
      </div>
      {error && <p role="alert" className="banner banner-danger" style={{ margin: '8px 0 0', fontSize: 13 }}>{error}</p>}
      <p style={{ margin: '10px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
        The AI marks the content against your marking points. It does not judge spelling or dialect unless a marking point asks for it. It was not shown the student&rsquo;s name.
        {usage ? ` ${usage.remaining} of ${usage.limit} suggestions left this month.` : ''}
      </p>
    </section>
  )
}
