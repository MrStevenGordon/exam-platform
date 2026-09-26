'use client'

// A compact "what should my CSV look like" panel for the import screens: the columns in a small table
// (required or optional, what goes in each), an example row, and a link to download a ready-made template.
export type CsvColumn = { name: string; required: boolean; description: string; example?: string }

export default function CsvFormatGuide({ columns, templateHref, templateName, notes }: {
  columns: CsvColumn[]
  templateHref: string
  templateName: string
  notes?: string[]
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
        <span className="section-label" style={{ margin: 0 }}>Your file needs these columns, in any order</span>
        <a href={templateHref} download={templateName} className="btn btn-secondary" style={{ fontSize: 12, padding: '6px 12px' }}>
          Download template
        </a>
      </div>
      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--page-bg)' }}>
              <th style={th}>Column</th>
              <th style={th}>Needed?</th>
              <th style={th}>What goes in it</th>
              <th style={th}>Example</th>
            </tr>
          </thead>
          <tbody>
            {columns.map((c) => (
              <tr key={c.name}>
                <td style={{ ...td, fontFamily: 'var(--font-mono, monospace)', fontWeight: 600, whiteSpace: 'nowrap' }}>{c.name}</td>
                <td style={td}>
                  <span className={`badge ${c.required ? 'badge-success' : 'badge-default'}`}>{c.required ? 'Required' : 'Optional'}</span>
                </td>
                <td style={{ ...td, color: 'var(--text-secondary)' }}>{c.description}</td>
                <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{c.example || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {notes && notes.length > 0 && (
        <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
      )}
    </div>
  )
}

const th: React.CSSProperties = { padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }
const td: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid var(--border)', verticalAlign: 'top' }
