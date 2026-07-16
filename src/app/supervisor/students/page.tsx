'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Student = {
  id: string
  full_name: string
  student_id: string | null
  grade_level: number | null
  class_name?: string
}

export default function SupervisorStudentsPage() {
  const router = useRouter()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterGrade, setFilterGrade] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [classDropdownOpen, setClassDropdownOpen] = useState(false)
  const [expandedFilterGrade, setExpandedFilterGrade] = useState<number | null>(null)
  const classDropdownRef = useRef<HTMLDivElement>(null)
  const [expandedGrades, setExpandedGrades] = useState<Set<string>>(new Set())
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set())

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (classDropdownRef.current && !classDropdownRef.current.contains(e.target as Node)) {
        setClassDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, student_id, grade_level, enrollments(class_groups(name))')
      .eq('role', 'student')
      .order('grade_level', { ascending: true })

    const mapped = (data || []).map((s: any) => ({
      id: s.id,
      full_name: s.full_name,
      student_id: s.student_id,
      grade_level: s.grade_level,
      class_name: s.enrollments?.[0]?.class_groups?.name || null,
    }))
    setStudents(mapped)
    setLoading(false)
  }

  if (loading) return <div>Loading…</div>

  const filtered = students.filter((s) => {
    const matchSearch = !search || s.full_name?.toLowerCase().includes(search.toLowerCase()) || s.student_id?.includes(search)
    const matchGrade = !filterGrade || s.grade_level === parseInt(filterGrade)
    const matchClass = !filterClass || s.class_name === filterClass
    return matchSearch && matchGrade && matchClass
  })

  const classesByGrade: Record<number, string[]> = {}
  students.forEach((s) => {
    if (!s.class_name || !s.grade_level) return
    if (!classesByGrade[s.grade_level]) classesByGrade[s.grade_level] = []
    if (!classesByGrade[s.grade_level].includes(s.class_name)) classesByGrade[s.grade_level].push(s.class_name)
  })
  Object.keys(classesByGrade).forEach((g) => {
    classesByGrade[parseInt(g)].sort((a, b) => {
      const aNum = parseInt((a || '').split('-')[1] || '0')
      const bNum = parseInt((b || '').split('-')[1] || '0')
      return aNum - bNum
    })
  })

  return (
    <div>
      <p className="portal-page-title" style={{ margin: 0 }}>Students</p>
      <p className="portal-page-sub" style={{ margin: '4px 0 20px' }}>{students.length} students · click a name for details</p>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search by name or student ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 2, minWidth: 160 }}
        />
        <div ref={classDropdownRef} style={{ position: 'relative', flex: 1, minWidth: 160 }}>
          <button
            type="button"
            onClick={() => setClassDropdownOpen(!classDropdownOpen)}
            style={{
              width: '100%',
              textAlign: 'left',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'white',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '9px 12px',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            <span>{filterClass || 'All classes'}</span>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{classDropdownOpen ? '▴' : '▾'}</span>
          </button>

          {classDropdownOpen && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: 4,
              background: 'white',
              border: '1px solid var(--border)',
              borderRadius: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              maxHeight: 320,
              overflowY: 'auto',
              zIndex: 50,
            }}>
              <div
                onClick={() => { setFilterClass(''); setFilterGrade(''); setClassDropdownOpen(false) }}
                style={{ padding: '10px 12px', cursor: 'pointer', fontWeight: 600, fontSize: 14, borderBottom: '1px solid var(--border)' }}
              >
                All classes
              </div>
              {[7, 8, 9, 10, 11].map((g) => {
                const classes = classesByGrade[g]
                if (!classes || classes.length === 0) return null
                const isExpanded = expandedFilterGrade === g
                return (
                  <div key={g}>
                    <div
                      onClick={() => setExpandedFilterGrade(isExpanded ? null : g)}
                      style={{
                        padding: '10px 12px',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: 13,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'var(--page-bg)',
                      }}
                    >
                      <span>Grade {g}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{isExpanded ? '▴' : '▾'}</span>
                    </div>
                    {isExpanded && classes.map((c) => (
                      <div
                        key={c}
                        onClick={() => {
                          setFilterClass(c)
                          setFilterGrade(String(g))
                          setClassDropdownOpen(false)
                        }}
                        style={{
                          padding: '9px 12px 9px 24px',
                          cursor: 'pointer',
                          fontSize: 14,
                          background: filterClass === c ? 'var(--accent-light)' : undefined,
                        }}
                      >
                        {c}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="card"><p style={{ color: 'var(--text-secondary)' }}>No students found.</p></div>
      )}

      {[7, 8, 9, 10, 11].map((grade) => {
        const gradeStudents = filtered.filter((s) => s.grade_level === grade)
        if (gradeStudents.length === 0) return null
        const classes = [...new Set(gradeStudents.map((s) => s.class_name).filter(Boolean))].sort((a, b) => {
          const aNum = parseInt((a || '').split('-')[1] || '0')
          const bNum = parseInt((b || '').split('-')[1] || '0')
          return aNum - bNum
        })

        return (
          <div key={grade} style={{ marginBottom: 16 }}>
            <div
              onClick={() => {
                const key = `grade-${grade}`
                setExpandedGrades((prev) => {
                  const next = new Set(prev)
                  if (next.has(key)) next.delete(key)
                  else next.add(key)
                  return next
                })
              }}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--card-bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', cursor: 'pointer', marginBottom: 8 }}
            >
              <div style={{ fontWeight: 700, fontSize: 15 }}>Grade {grade}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{gradeStudents.length} students</span>
                <span style={{ color: 'var(--text-secondary)' }}>{expandedGrades.has(`grade-${grade}`) ? '▲' : '▼'}</span>
              </div>
            </div>

            {expandedGrades.has(`grade-${grade}`) && (
              <div style={{ paddingLeft: 12 }}>
                {classes.map((cls) => {
                  const classStudents = gradeStudents.filter((s) => s.class_name === cls)
                  const classKey = `class-${grade}-${cls}`
                  return (
                    <div key={cls} style={{ marginBottom: 8 }}>
                      <div
                        onClick={() => {
                          setExpandedClasses((prev) => {
                            const next = new Set(prev)
                            if (next.has(classKey)) next.delete(classKey)
                            else next.add(classKey)
                            return next
                          })
                        }}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--page-bg)', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', marginBottom: 6 }}
                      >
                        <div style={{ fontWeight: 700, fontSize: 13 }}>Class {cls}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{classStudents.length} students</span>
                          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{expandedClasses.has(classKey) ? '▲' : '▼'}</span>
                        </div>
                      </div>

                      {expandedClasses.has(classKey) && (
                        <div style={{ paddingLeft: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {classStudents.map((s) => (
                            <Link key={s.id} href={`/supervisor/student/${s.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--card-bg)', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer' }}>
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: 13 }}>{s.full_name}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>ID: {s.student_id}</div>
                                </div>
                                <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>→</span>
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
