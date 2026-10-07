'use client'

import { useEffect, useState } from 'react'
import { addVideo, updateVideo, type VideoFields } from '@/lib/videos'
import { loadTopicOptions, type TopicOption } from '@/lib/classFeedback'
import { LINK_HELP, PROVIDER_LABEL, parseVideoLink, type Video } from '@/lib/videosPure'

// Adding a video link (or changing one already added). The link itself can never be changed afterwards: remove the video and add the right one.

const label = { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 } as const
const GRADES = [7, 8, 9, 10, 11, 12, 13]
const SUBJECTS = ['Mathematics', 'English Language', 'Science', 'Social Studies', 'Spanish', 'Information Technology', 'Civics', 'Resource and Technology']

export default function VideoForm({ video, knownSubjects, isManager, onDone, onCancel }: { video?: Video; knownSubjects: string[]; isManager: boolean; onDone: (message: string) => void; onCancel?: () => void }) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState(video?.title ?? '')
  const [note, setNote] = useState(video?.note ?? '')
  const [subject, setSubject] = useState(video?.subject ?? '')
  const [topicId, setTopicId] = useState<string>(video?.topic_id ?? '')
  const [gradeFrom, setGradeFrom] = useState<string>(video?.grade_from ? String(video.grade_from) : '')
  const [gradeTo, setGradeTo] = useState<string>(video?.grade_to ? String(video.grade_to) : '')
  const [topics, setTopics] = useState<TopicOption[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const parsed = url.trim() ? parseVideoLink(url) : null
  const id = video?.id ?? 'new'

  useEffect(() => {
    let cancelled = false
    if (subject.trim().length < 2) return
    loadTopicOptions(subject, null).then((t) => { if (!cancelled) setTopics(t) }).catch(() => { if (!cancelled) setTopics([]) })
    return () => { cancelled = true }
  }, [subject])

  async function save() {
    setBusy(true); setError('')
    const f: VideoFields = { title, note, subject, topicId: topicId || null, gradeFrom: gradeFrom ? Number(gradeFrom) : null, gradeTo: gradeTo ? Number(gradeTo) : null }
    const r = video ? await updateVideo(video.id, f) : await addVideo(url, f)
    setBusy(false)
    if (!r.ok) { setError(r.error); return }
    onDone(video ? (isManager || video.status !== 'approved' ? 'Saved.' : 'Saved. It will show to students again once it is approved.')
      : isManager ? 'Added. Students can see it now.' : 'Added. Students will see it once your head of department approves it.')
    if (!video) { setUrl(''); setTitle(''); setNote(''); setTopicId('') }
  }

  const subjects = [...new Set([...knownSubjects, ...SUBJECTS])]
  return (
    <div className="card" style={{ marginTop: 14 }}>
      {!video && (
        <div style={{ marginBottom: 12 }}>
          <label style={label} htmlFor={`url-${id}`}>Link to the video</label>
          <input id={`url-${id}`} type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." autoComplete="off" />
          <p style={{ fontSize: 12, margin: '4px 0 0', color: parsed ? 'var(--success, #2D7A4F)' : 'var(--text-secondary)' }}>
            {!url.trim() ? `${LINK_HELP} Videos stay on their own site; nothing is uploaded here.` : parsed ? `${PROVIDER_LABEL[parsed.provider]} link recognised.` : `That link is not one we accept. ${LINK_HELP}`}
          </p>
        </div>
      )}
      <div style={{ marginBottom: 12 }}>
        <label style={label} htmlFor={`title-${id}`}>Title</label>
        <input id={`title-${id}`} value={title} maxLength={150} onChange={(e) => setTitle(e.target.value)} placeholder="What students will see, e.g. Percentages made easy" />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={label} htmlFor={`note-${id}`}>Why watch it? (optional)</label>
        <textarea id={`note-${id}`} rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="One sentence, e.g. Watch this before the Thursday test" />
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ flex: '1 1 220px' }}>
          <label style={label} htmlFor={`sub-${id}`}>Subject</label>
          <input id={`sub-${id}`} list={`subs-${id}`} value={subject} maxLength={100} onChange={(e) => { setSubject(e.target.value); setTopicId('') }} />
          <datalist id={`subs-${id}`}>{subjects.map((s) => <option key={s} value={s} />)}</datalist>
        </div>
        {topics.length > 0 && (
          <div style={{ flex: '1 1 220px' }}>
            <label style={label} htmlFor={`topic-${id}`}>Topic (optional)</label>
            <select id={`topic-${id}`} value={topicId} onChange={(e) => setTopicId(e.target.value)}>
              <option value="">Any topic</option>
              {topics.map((t) => <option key={t.id} value={t.id}>{t.unit ? `${t.unit}: ` : ''}{t.name}</option>)}
            </select>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ flex: '1 1 140px' }}>
          <label style={label} htmlFor={`gf-${id}`}>From grade</label>
          <select id={`gf-${id}`} value={gradeFrom} onChange={(e) => setGradeFrom(e.target.value)}><option value="">Any</option>{GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}</select>
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <label style={label} htmlFor={`gt-${id}`}>To grade</label>
          <select id={`gt-${id}`} value={gradeTo} onChange={(e) => setGradeTo(e.target.value)}><option value="">Any</option>{GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}</select>
        </div>
      </div>
      {!video && !isManager && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 12px' }}>Your head of department approves each video before students can see it.</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-primary" disabled={busy || (!video && !parsed)} onClick={save}>{busy ? 'Saving…' : video ? 'Save changes' : 'Add video'}</button>
        {onCancel && <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>}
      </div>
      {error && <p role="alert" className="banner banner-danger" style={{ marginTop: 10 }}>{error}</p>}
    </div>
  )
}
