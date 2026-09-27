'use client'

// A small "How this works" note that stays out of the way: closed by default, one click to read the details.
// Used where a page used to open with a long paragraph of explanation.
export default function HowItWorks({ title = 'How this works', children }: { title?: string; children: React.ReactNode }) {
  return (
    <details style={{ margin: '0 0 16px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card-bg)' }}>
      <summary style={{ cursor: 'pointer', padding: '8px 12px', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{title}</summary>
      <div style={{ padding: '0 12px 10px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{children}</div>
    </details>
  )
}
