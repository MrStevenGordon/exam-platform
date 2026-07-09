'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type ClassGroup = {
  id: string
  name: string
  year_grade: string
  students: { id: string; full_name: string; student_id: string }[]
}

export default function SupervisorClassesPage() {
  const router = useRouter()
  const [classes, setClasses] = useState<ClassGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Get supervisor's assigned classes from teacher_class_groups
      const { data: assignedClasses } = await supabase
        .from('teacher_class_groups')
        .select('class_group_id, class_groups(id, name, year_grade)')
        .eq('teacher_id', user.id)

      if (!assignedClasses || assignedClasses.length === 0) { setLoading(false); return }

      const allClasses = assignedClasses.map((ac: any) => ac.class_groups).filter(Boolean)
      const classIds = allClasses.map((c: any) => c.id)

      // Get all enrollments
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('class_group_id, profiles!enrollments_student_id_fkey(id, full_name, student_id)')
        .in('class_group_id', classIds)

      const classMap: Record<string, ClassGroup> = {}
      allClasses.forEach((cg) => {
        classMap[cg.id] = { id: cg.id, name: cg.name, year_grade: cg.year_grade, students: [] }
      })

      ;(enrollments || []).forEach((e: any) => {
        if (classMap[e.class_group_id] && e.profiles) {
          classMap[e.class_group_id].students.push(e.profiles)
        }
      })

      setClasses(Object.values(classMap).sort((a, b) => {
        if (a.year_grade !== b.year_grade) return a.year_grade.localeCompare(b.year_grade)
        return a.name.localeCompare(b.name)
      }))
      setLoading(false)
    }
    load()
  }, [])

  function toggleClass(id: string) {
    setExpandedClasses((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) return <div>Loading…</div>

  const grades = [...new Set(classes.map((c) => c.year_grade))].sort()
  const totalStudents = classes.reduce((sum, c) => sum + c.students.length, 0)

  return (
    <div>
      <p className="portal-page-title">My Classes</p>
      <p className="portal-page-sub">{classes.length} classes · {totalStudents} students</p>

      {classes.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📚</div>
          <p style={{ fontWeight: 700, margin: '0 0 6px' }}>No classes assigned</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 16px' }}>
            Go to My Profile to select the classes you teach.
          </p>
          <a href="/supervisor/profile" style={{ color: 'var(--accent-dark)', fontWeight: 700, fontSize: 13 }}>
            Set up my classes →
          </a>
        </div>
      )}

      {classes.length > 0 && (
      <input
        type="text"
        placeholder="Search students…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: '100%', marginBottom: 16 }}
      />
      )}

      {grades.map((grade) => {
        const gradeClasses = classes.filter((c) => c.year_grade === grade)
        return (
          <div key={grade} style={{ marginBottom: 20 }}>
            <div className="section-label" style={{ marginBottom: 10 }}>
              {grade} · {gradeClasses.reduce((sum, c) => sum + c.students.length, 0)} students
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {gradeClasses.map((cls) => {
                const filteredStudents = cls.students.filter((s) =>
                  !search || s.full_name.toLowerCase().includes(search.toLowerCase()) || s.student_id?.includes(search)
                )
                if (search && filteredStudents.length === 0) return null
                return (
                  <div key={cls.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div
                      onClick={() => toggleClass(cls.id)}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', cursor: 'pointer' }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>Class {cls.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                          {cls.students.length} student{cls.students.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <span style={{ color: 'var(--text-secondary)', fontSize: 18 }}>
                        {expandedClasses.has(cls.id) ? '▲' : '▼'}
                      </span>
                    </div>
                    {expandedClasses.has(cls.id) && (
                      <div style={{ borderTop: '1px solid var(--border)', background: 'var(--page-bg)' }}>
                        {filteredStudents.sort((a, b) => a.full_name.localeCompare(b.full_name)).map((s, i) => (
                          <div key={s.id} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '10px 16px',
                            borderBottom: i < filteredStudents.length - 1 ? '1px solid var(--border)' : 'none',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--accent-dark)', flexShrink: 0 }}>
                                {s.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{s.full_name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>ID: {s.student_id}</div>
                              </div>
                            </div>
                            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{i + 1}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
