'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Student = { id: string; full_name: string }
type Group = { id: string; name: string; members: Student[] }

export default function ManageGroupsPage() {
  const router = useRouter()
  const params = useParams()
  const examId = params.id as string

  const [examTitle, setExamTitle] = useState('')
  const [allStudents, setAllStudents] = useState<Student[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [newGroupName, setNewGroupName] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => { loadData() }, [examId])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: examData } = await supabase.from('draft_exams').select('title').eq('id', examId).single()
    setExamTitle(examData?.title || '')

    const { data: classLinks } = await supabase.from('teacher_class_groups').select('class_group_id').eq('teacher_id', user.id)
    const classGroupIds = (classLinks || []).map((c) => c.class_group_id)

    let students: Student[] = []
    if (classGroupIds.length > 0) {
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('student_id, profiles!enrollments_student_id_fkey(id, full_name)')
        .in('class_group_id', classGroupIds)

      const seen = new Set<string>()
      ;(enrollments || []).forEach((e: any) => {
        if (e.profiles && !seen.has(e.profiles.id)) {
          seen.add(e.profiles.id)
          students.push({ id: e.profiles.id, full_name: e.profiles.full_name })
        }
      })
      students.sort((a, b) => a.full_name.localeCompare(b.full_name))
    }
    setAllStudents(students)

    const { data: groupData } = await supabase
      .from('project_groups')
      .select('id, name, project_group_members(student_id, profiles!project_group_members_student_id_fkey(id, full_name))')
      .eq('draft_exam_id', examId)
      .order('name')

    const mappedGroups: Group[] = (groupData || []).map((g: any) => ({
      id: g.id,
      name: g.name,
      members: (g.project_group_members || []).map((m: any) => ({ id: m.profiles?.id, full_name: m.profiles?.full_name })).filter((m: any) => m.id),
    }))
    setGroups(mappedGroups)
    setLoading(false)
  }

  async function handleAddGroup() {
    if (!newGroupName.trim()) return
    const { error } = await supabase.from('project_groups').insert({ draft_exam_id: examId, name: newGroupName.trim() })
    if (error) { setErrorMsg(error.message); return }
    setNewGroupName('')
    loadData()
  }

  async function handleDeleteGroup(groupId: string) {
    if (!confirm('Delete this group? Members will become unassigned.')) return
    await supabase.from('project_groups').delete().eq('id', groupId)
    loadData()
  }

  async function handleAddMember(groupId: string, studentId: string) {
    setErrorMsg('')
    const { error } = await supabase.from('project_group_members').insert({ group_id: groupId, student_id: studentId })
    if (error) { setErrorMsg(error.message); return }
    loadData()
  }

  async function handleRemoveMember(groupId: string, studentId: string) {
    await supabase.from('project_group_members').delete().eq('group_id', groupId).eq('student_id', studentId)
    loadData()
  }

  if (loading) return <div className="page-container">Loading…</div>

  const groupedStudentIds = new Set(groups.flatMap((g) => g.members.map((m) => m.id)))
  const ungroupedStudents = allStudents.filter((s) => !groupedStudentIds.has(s.id))

  return (
    <div className="page-container">
      <Link href={`/teacher/exam/${examId}`} style={{ color: 'var(--text-secondary)', fontSize: 14 }}>&larr; Back to {examTitle}</Link>
      <h1 style={{ marginTop: 16 }}>Manage Groups</h1>

      {errorMsg && <div className="banner banner-danger" style={{ marginBottom: 16 }}>{errorMsg}</div>}

      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ marginBottom: 12 }}>Add a group</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="e.g. Group 1"
            style={{ flex: 1 }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddGroup() }}
          />
          <button onClick={handleAddGroup} disabled={!newGroupName.trim()} className="btn btn-primary">Add group</button>
        </div>
      </div>

      {ungroupedStudents.length > 0 && (
        <div className="card" style={{ marginBottom: 20, background: 'var(--page-bg)' }}>
          <h2 style={{ marginBottom: 8, fontSize: 15 }}>Ungrouped students ({ungroupedStudents.length})</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ungroupedStudents.map((s) => (
              <span key={s.id} className="badge badge-default">{s.full_name}</span>
            ))}
          </div>
        </div>
      )}

      {groups.map((group) => (
        <div key={group.id} className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h2 style={{ margin: 0 }}>{group.name}</h2>
            <div style={{ display: 'flex', gap: 6 }}>
              <Link href={`/teacher/exam/${examId}/groups/${group.id}`}>
                <button className="btn btn-secondary" style={{ fontSize: 12 }}>Grade this group</button>
              </Link>
              <button onClick={() => handleDeleteGroup(group.id)} className="btn btn-ghost" style={{ fontSize: 11, color: 'var(--danger)' }}>Delete group</button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {group.members.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No members yet.</p>}
            {group.members.map((m) => (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--page-bg)', borderRadius: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{m.full_name}</span>
                <button onClick={() => handleRemoveMember(group.id, m.id)} className="btn btn-ghost" style={{ fontSize: 11 }}>Remove</button>
              </div>
            ))}
          </div>

          {ungroupedStudents.length > 0 && (
            <select
              value=""
              onChange={(e) => { if (e.target.value) handleAddMember(group.id, e.target.value) }}
              style={{ width: '100%' }}
            >
              <option value="">+ Add student to this group…</option>
              {ungroupedStudents.map((s) => (
                <option key={s.id} value={s.id}>{s.full_name}</option>
              ))}
            </select>
          )}
        </div>
      ))}

      {groups.length === 0 && (
        <div className="card">
          <p style={{ color: 'var(--text-secondary)' }}>No groups yet. Add one above to get started.</p>
        </div>
      )}
    </div>
  )
}
