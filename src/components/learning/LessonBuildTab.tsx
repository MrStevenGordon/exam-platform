'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import TopicPicker from '@/components/TopicPicker'
import {
  STEP_INFO, STEP_KEYS, allReady, defaultResourceTitle, isWebUrl, readyCount, resourceKindFor,
  type LessonRow, type LessonStep,
} from '@/lib/learning'

const KIND_LABEL = { video: 'Video', file: 'File', link: 'Link' } as const

// Where a teacher turns a lesson plan into something students can use: reword each step for
// them, add links, approve every step, then publish.
export default function LessonBuildTab({ lesson, onSaved, onGoAssign }: { lesson: LessonRow; onSaved: () => void; onGoAssign: () => void }) {
  const [title, setTitle] = useState(lesson.title)
  const [keyTerms, setKeyTerms] = useState(lesson.key_terms)
  const [topicId, setTopicId] = useState<string | null>(lesson.topic_id)
  const [steps, setSteps] = useState<LessonStep[]>(lesson.steps.map((s) => ({ ...s, resources: s.resources.map((r) => ({ ...r })) })))
  const [open, setOpen] = useState<number>(0)
  const [urlDraft, setUrlDraft] = useState<Record<number, { url: string; title: string }>>({})
  const [stepError, setStepError] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const published = lesson.status === 'published'
  const dirty = title !== lesson.title || keyTerms !== lesson.key_terms || topicId !== lesson.topic_id || JSON.stringify(steps) !== JSON.stringify(lesson.steps)

  const update = (i: number, patch: Partial<LessonStep>) => {
    setSteps((prev) => prev.map((s, k) => (k === i ? { ...s, ...patch } : s)))
    setStepError((e) => ({ ...e, [i]: '' })); setNotice('')
  }

  function addResource(i: number) {
    const d = urlDraft[i] || { url: '', title: '' }
    const url = d.url.trim()
    if (!isWebUrl(url)) { setStepError((e) => ({ ...e, [i]: 'Paste a web address that starts with http:// or https://' })); return }
    if (steps[i].resources.length >= 8) { setStepError((e) => ({ ...e, [i]: 'A step can have up to 8 links' })); return }
    update(i, { resources: [...steps[i].resources, { url, title: d.title.trim() || defaultResourceTitle(url), kind: resourceKindFor(url) }] })
    setUrlDraft((prev) => ({ ...prev, [i]: { url: '', title: '' } }))
  }

  function toggleApproved(i: number) {
    if (!steps[i].approved && !steps[i].text.trim()) { setStepError((e) => ({ ...e, [i]: 'Write what students should do in this step before approving it' })); return }
    update(i, { approved: !steps[i].approved })
  }

  // Saves the edits. A published lesson has to stay complete, so if an edit would leave a
  // step unapproved it is taken back to draft first (students lose access until republished).
  async function save(): Promise<boolean> {
    if (!title.trim()) { setError('The lesson needs a title'); return false }
    setBusy(true); setError('')
    if (published && !allReady(steps)) {
      if (!confirm('A step is no longer approved, so this lesson will be taken away from students until you publish it again. Continue?')) { setBusy(false); return false }
      const { error: e } = await supabase.rpc('learning_unpublish', { p_lesson_id: lesson.id })
      if (e) { setBusy(false); setError('Could not save. Please try again.'); return false }
    }
    const { error: e } = await supabase.from('learning_lessons').update({ title: title.trim(), key_terms: keyTerms.trim(), topic_id: topicId, steps }).eq('id', lesson.id)
    setBusy(false)
    if (e) { setError(e.message || 'Could not save. Please try again.'); return false }
    setNotice('Saved.'); onSaved()
    return true
  }

  async function publish() {
    if (!allReady(steps)) { setError(`Approve all five steps first. ${readyCount(steps)} of 5 are ready.`); return }
    if (dirty && !(await save())) return
    setBusy(true); setError('')
    const { error: e } = await supabase.rpc('learning_publish', { p_lesson_id: lesson.id })
    setBusy(false)
    if (e) { setError(e.message || 'Could not publish. Please try again.'); return }
    setNotice('Published. Next, give it to a class.'); onSaved()
  }

  async function unpublish() {
    if (!confirm('Students will no longer be able to open this lesson until you publish it again. Their progress is kept.')) return
    setBusy(true); setError('')
    const { error: e } = await supabase.rpc('learning_unpublish', { p_lesson_id: lesson.id })
    setBusy(false)
    if (e) { setError('Could not unpublish. Please try again.'); return }
    setNotice('Unpublished.'); onSaved()
  }

  async function remove() {
    if (!confirm('Delete this lesson? It is removed from any class it was given to, and students’ progress on it is deleted. This cannot be undone.')) return
    setBusy(true)
    const { error: e } = await supabase.from('learning_lessons').delete().eq('id', lesson.id)
    if (e) { setBusy(false); setError('Could not delete the lesson.'); return }
    window.location.href = '/learning'
  }

  return (
    <div>
      {error && <p className="banner banner-danger" role="alert">{error}</p>}
      {notice && <p className="banner banner-success" role="status">{notice}</p>}

      <div className="card" style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }} htmlFor="ltitle">Lesson title</label>
        <input id="ltitle" value={title} onChange={(e) => { setTitle(e.target.value); setNotice('') }} style={{ width: '100%', margin: '4px 0 12px' }} />
        <TopicPicker subject={lesson.subject} grade={lesson.grade} value={topicId} onChange={(t) => { setTopicId(t?.id ?? null); setNotice('') }} label="Curriculum topic (optional)" />
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 12 }} htmlFor="lterms">Key formulae and vocabulary (one per line, shown beside the lesson)</label>
        <textarea id="lterms" value={keyTerms} onChange={(e) => { setKeyTerms(e.target.value); setNotice('') }} rows={4} placeholder={'I = P × R × T\nP = Principal: the starting amount'} style={{ width: '100%', marginTop: 4 }} />
      </div>

      {steps.map((s, i) => {
        const info = STEP_INFO[STEP_KEYS[i]]
        const isOpen = open === i
        const ready = s.approved && s.text.trim().length > 0
        return (
          <div key={s.key} className="card" style={{ marginBottom: 8 }}>
            <button type="button" onClick={() => setOpen(isOpen ? -1 : i)} aria-expanded={isOpen} style={{ all: 'unset', boxSizing: 'border-box', width: '100%', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}><i className={`ti ti-chevron-${isOpen ? 'down' : 'right'}`} aria-hidden="true" /> <i className={`ti ${info.icon}`} aria-hidden="true" /> {info.label}</span>
              <span className={`badge ${ready ? 'badge-success' : s.text.trim() ? 'badge-warning' : 'badge-default'}`}>{ready ? 'Approved' : s.text.trim() ? 'Needs your approval' : 'Empty'}</span>
            </button>
            {isOpen && (
              <div style={{ marginTop: 10 }}>
                <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--text-muted)' }}>{info.hint}. Write it for students. Leave a blank line between paragraphs.</p>
                <textarea value={s.text} onChange={(e) => update(i, { text: e.target.value, approved: e.target.value.trim() ? s.approved : false })} rows={6} aria-label={`${info.label} text for students`} style={{ width: '100%' }} />

                <div style={{ margin: '10px 0 6px', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Links for students</div>
                {s.resources.map((r, k) => (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '4px 0' }}>
                    <span className="badge badge-default">{KIND_LABEL[r.kind]}</span>
                    <span style={{ flex: 1, overflowWrap: 'anywhere' }}>{r.title} <span style={{ color: 'var(--text-muted)' }}>· {r.url}</span></span>
                    <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => update(i, { resources: s.resources.filter((_, x) => x !== k) })} aria-label={`Remove ${r.title}`}>Remove</button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                  <input value={urlDraft[i]?.url ?? ''} onChange={(e) => { setUrlDraft((p) => ({ ...p, [i]: { url: e.target.value, title: p[i]?.title ?? '' } })); setStepError((x) => ({ ...x, [i]: '' })) }} placeholder="https://…  (a video, worksheet or website)" aria-label="Link address" style={{ flex: 2, minWidth: 220 }} />
                  <input value={urlDraft[i]?.title ?? ''} onChange={(e) => setUrlDraft((p) => ({ ...p, [i]: { url: p[i]?.url ?? '', title: e.target.value } }))} placeholder="Name (optional)" aria-label="Link name" style={{ flex: 1, minWidth: 120 }} />
                  <button type="button" className="btn btn-secondary" onClick={() => addResource(i)}>Add link</button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, gap: 8, flexWrap: 'wrap' }}>
                  <span className="no" role="alert" style={{ fontSize: 13, color: 'var(--danger)' }}>{stepError[i]}</span>
                  <button type="button" className={s.approved ? 'btn btn-ghost' : 'btn btn-primary'} onClick={() => toggleApproved(i)}>{s.approved ? 'Undo approval' : 'Approve this step'}</button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14 }}>{readyCount(steps)} of 5 steps approved{dirty ? ' · unsaved changes' : ''}</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={save} disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save changes'}</button>
          {published
            ? <><button type="button" className="btn btn-ghost" onClick={unpublish} disabled={busy}>Unpublish</button><button type="button" className="btn btn-primary" onClick={onGoAssign}>Give to a class</button></>
            : <button type="button" className="btn btn-primary" onClick={publish} disabled={busy}>Publish lesson</button>}
        </div>
      </div>
      <p style={{ marginTop: 12 }}>
        <button type="button" className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--danger)' }} onClick={remove} disabled={busy}>Delete this lesson</button>
      </p>
    </div>
  )
}
