'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Member = { id: string; full_name: string }

export default function GroupProjectPage() {
  const router = useRouter()
  const params = useParams()
  const examId = params.id as string

  const [examTitle, setExamTitle] = useState('')
  const [groupId, setGroupId] = useState('')
  const [groupName, setGroupName] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [sessionId, setSessionId] = useState('')
  const [alreadySubmitted, setAlreadySubmitted] = useState(false)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [contribution, setContribution] = useState('')
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => { loadData() }, [examId])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: examData } = await supabase.from('draft_exams').select('title').eq('id', examId).single()
    setExamTitle(examData?.title || '')

    const { data: membership } = await supabase
      .from('project_group_members')
      .select('group_id')
      .eq('student_id', user.id)
      .in('group_id', (await supabase.from('project_groups').select('id').eq('draft_exam_id', examId)).data?.map((g) => g.id) || [])
      .maybeSingle()

    if (!membership) {
      setLoading(false)
      return
    }

    setGroupId(membership.group_id)

    const { data: group } = await supabase
      .from('project_groups')
      .select('name, file_submission_url, file_submission_name')
      .eq('id', membership.group_id)
      .single()

    if (group) {
      setGroupName(group.name)
      setFileUrl(group.file_submission_url)
      setFileName(group.file_submission_name)
    }

    const { data: memberRows } = await supabase
      .from('project_group_members')
      .select('student_id, profiles!project_group_members_student_id_fkey(id, full_name)')
      .eq('group_id', membership.group_id)

    const memberList: Member[] = (memberRows || [])
      .map((m: any) => ({ id: m.profiles?.id, full_name: m.profiles?.full_name }))
      .filter((m: any) => m.id && m.id !== user.id)
    setMembers(memberList)

    let { data: session } = await supabase
      .from('exam_sessions')
      .select('id, status, contribution_statement')
      .eq('draft_exam_id', examId)
      .eq('student_id', user.id)
      .maybeSingle()

    if (!session) {
      const { data: newSession } = await supabase
        .from('exam_sessions')
        .insert({ draft_exam_id: examId, student_id: user.id, status: 'in_progress', started_at: new Date().toISOString(), group_id: membership.group_id })
        .select('id, status, contribution_statement')
        .single()
      session = newSession
    }

    if (session) {
      setSessionId(session.id)
      setAlreadySubmitted(session.status === 'completed')
      setContribution(session.contribution_statement || '')
    }

    const { data: existingRatings } = await supabase
      .from('peer_ratings')
      .select('ratee_student_id, rating')
      .eq('group_id', membership.group_id)
      .eq('rater_student_id', user.id)

    const ratingsMap: Record<string, number> = {}
    ;(existingRatings || []).forEach((r) => { ratingsMap[r.ratee_student_id] = r.rating })
    setRatings(ratingsMap)

    setLoading(false)
  }

  const FILE_MAX_MB = 25

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setErrorMsg('')
    if (file.size > FILE_MAX_MB * 1024 * 1024) {
      setErrorMsg(`File is too large (max ${FILE_MAX_MB}MB).`)
      e.target.value = ''
      return
    }
    setUploadingFile(true)
    const { data: { user } } = await supabase.auth.getUser()
    const path = `group/${groupId}/${Date.now()}-${file.name.replace(/\s/g, '_')}`
    const { error } = await supabase.storage.from('task-submissions').upload(path, file, { upsert: true })
    if (error) {
      setErrorMsg('Upload failed: ' + error.message)
      setUploadingFile(false)
      return
    }
    const { data: urlData } = supabase.storage.from('task-submissions').getPublicUrl(path)
    const { error: updateError } = await supabase
      .from('project_groups')
      .update({ file_submission_url: urlData.publicUrl, file_submission_name: file.name, file_uploaded_by: user?.id, file_uploaded_at: new Date().toISOString() })
      .eq('id', groupId)
    if (updateError) { setErrorMsg(updateError.message); setUploadingFile(false); return }
    setFileUrl(urlData.publicUrl)
    setFileName(file.name)
    setUploadingFile(false)
  }

  async function handleSubmit() {
    if (!contribution.trim()) {
      setErrorMsg('Please describe what you personally contributed before submitting.')
      return
    }
    setSubmitting(true)
    setErrorMsg('')

    const { data: { user } } = await supabase.auth.getUser()

    const { error: sessionError } = await supabase
      .from('exam_sessions')
      .update({ status: 'completed', completed_at: new Date().toISOString(), contribution_statement: contribution.trim() })
      .eq('id', sessionId)

    if (sessionError) { setErrorMsg(sessionError.message); setSubmitting(false); return }

    for (const member of members) {
      const rating = ratings[member.id]
      if (rating) {
        await supabase.from('peer_ratings').upsert(
          { group_id: groupId, rater_student_id: user!.id, ratee_student_id: member.id, rating },
          { onConflict: 'group_id,rater_student_id,ratee_student_id' }
        )
      }
    }

    setSubmitting(false)
    setAlreadySubmitted(true)
  }

  if (loading) return <div className="page-container">Loading…</div>

  if (!groupId) {
    return (
      <div className="page-container">
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <p style={{ fontWeight: 700, marginBottom: 6 }}>You haven't been assigned to a group yet</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Check back once your teacher has organized groups for this project.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <Link href="/student/tasks" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>&larr; Back to tasks</Link>

      <h1 style={{ marginTop: 16 }}>{examTitle}</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>{groupName} · {members.length + 1} members</p>

      {alreadySubmitted && (
        <div className="banner banner-success" style={{ marginBottom: 16 }}>
          You've submitted your part of this group project.
        </div>
      )}
      {errorMsg && <div className="banner banner-danger" style={{ marginBottom: 16 }}>{errorMsg}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginBottom: 8 }}>Group members</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {members.map((m) => <span key={m.id} className="badge badge-default">{m.full_name}</span>)}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginBottom: 8 }}>Shared submission</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>Any group member can upload or replace this file.</p>
        {fileUrl ? (
          <a href={fileUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-dark)' }}>📎 {fileName}</a>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No file uploaded yet.</p>
        )}
        {!alreadySubmitted && (
          <div style={{ marginTop: 10 }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 8, border: '1.5px dashed var(--border-strong)', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
              {uploadingFile ? 'Uploading…' : fileUrl ? 'Replace file' : `Upload file (max ${FILE_MAX_MB}MB)`}
              <input type="file" onChange={handleFileUpload} style={{ display: 'none' }} disabled={uploadingFile} />
            </label>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginBottom: 8 }}>Your contribution</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>Describe what you personally did for this project.</p>
        <textarea
          value={contribution}
          onChange={(e) => setContribution(e.target.value)}
          rows={4}
          disabled={alreadySubmitted}
          placeholder="e.g. I researched the topic and wrote the introduction and conclusion sections..."
          style={{ width: '100%' }}
        />
      </div>

      {members.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ marginBottom: 8 }}>Rate your teammates</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>How much did each teammate contribute? (1 = very little, 5 = a full fair share)</p>
          {members.map((m) => (
            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{m.full_name}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={alreadySubmitted}
                    onClick={() => setRatings((prev) => ({ ...prev, [m.id]: n }))}
                    style={{
                      width: 32, height: 32, borderRadius: 6, border: '1px solid var(--border-strong)',
                      background: ratings[m.id] === n ? 'var(--accent)' : 'white',
                      color: ratings[m.id] === n ? 'white' : 'var(--text-primary)',
                      fontWeight: 700, cursor: alreadySubmitted ? 'default' : 'pointer',
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!alreadySubmitted && (
        <button onClick={handleSubmit} disabled={submitting} className="btn btn-primary" style={{ width: '100%' }}>
          {submitting ? 'Submitting…' : 'Submit my part'}
        </button>
      )}
    </div>
  )
}
