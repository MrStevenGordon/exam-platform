import type { TutorMessage } from '@/lib/tutorClient'

// A conversation between a student and the tutor, as an adult reads it.
export default function TutorTranscript({ messages, studentName }: { messages: TutorMessage[]; studentName: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {messages.map((m, i) => (
        <div key={i} style={{ alignSelf: m.role === 'student' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2, textAlign: m.role === 'student' ? 'right' : 'left' }}>{m.role === 'student' ? studentName : 'Tutor'}</div>
          <div style={{ padding: '8px 12px', borderRadius: 12, fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', background: m.role === 'student' ? 'var(--accent-light)' : 'var(--page-bg)', border: '1px solid var(--border)' }}>{m.content}</div>
        </div>
      ))}
    </div>
  )
}
