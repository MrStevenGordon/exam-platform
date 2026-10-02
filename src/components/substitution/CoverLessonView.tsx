'use client'

// Read-only view of the lesson attached to a class someone is covering, as returned by cover_lesson().
type Resource = { title?: string; url: string; kind?: string }
type Step = { key: string; text: string; resources?: Resource[] }
export type CoverLesson =
  | ({ kind: 'lesson_plan' } & Record<string, string | null>)
  | { kind: 'learning_lesson'; title: string; subject: string; grade: number | null; key_terms: string; steps: Step[] }

const PLAN_INTRO: Array<[string, string]> = [
  ['focus_question', 'Focus question'], ['specific_objective', 'Specific objective'], ['attainment_target', 'Attainment target'],
  ['skills', 'Skills'], ['prior_learning', 'Prior learning'], ['materials', 'Materials'],
]
const PLAN_STEPS: Array<[string, string]> = [
  ['engage', 'Engage'], ['explore', 'Explore'], ['explain', 'Explain'], ['elaborate', 'Elaborate'], ['evaluate', 'Evaluate'],
]
const STEP_LABEL: Record<string, string> = { engage: 'Engage', explore: 'Explore', explain: 'Explain', elaborate: 'Elaborate', evaluate: 'Evaluate' }

const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }
const bodyStyle: React.CSSProperties = { fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', margin: 0 }

function Block({ label, text }: { label: string; text: string | null | undefined }) {
  if (!text || !text.trim()) return null
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      <p style={bodyStyle}>{text}</p>
    </div>
  )
}

export default function CoverLessonView({ lesson }: { lesson: CoverLesson }) {
  if (lesson.kind === 'learning_lesson') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{lesson.title}</div>
        <Block label="Key terms" text={lesson.key_terms} />
        {(lesson.steps || []).map((s) => (
          <div key={s.key}>
            <Block label={STEP_LABEL[s.key] || s.key} text={s.text} />
            {(s.resources || []).length > 0 && (
              <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 13 }}>
                {(s.resources || []).map((r, i) => (
                  <li key={i}><a href={r.url} target="_blank" rel="noopener noreferrer">{r.title || r.url}</a></li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    )
  }

  const meta = [lesson.subject, lesson.grade ? `Grade ${lesson.grade}` : null, lesson.term, lesson.duration].filter(Boolean).join(' · ')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{lesson.topic}</div>
        {meta && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{meta}</div>}
      </div>
      {PLAN_INTRO.map(([key, label]) => <Block key={key} label={label} text={lesson[key]} />)}
      {PLAN_STEPS.map(([key, label]) => <Block key={key} label={label} text={lesson[key]} />)}
      <Block label="Success criteria" text={lesson.success_criteria} />
    </div>
  )
}
