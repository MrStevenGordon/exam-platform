'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Student = {
  id: string
  full_name: string
  student_id: string | null
  grade_level: number | null
  class_name?: string
}

type ImportResult = {
  name: string
  email: string
  status: 'success' | 'failed'
  reason?: string
}

const SCHOOL_DOMAIN = 'mhs.smartassess'
const DEFAULT_PASSWORD = 'Student.Test'
const CLASS_TO_GRADE: Record<string, number> = {
  '1': 7, '2': 8, '3': 9, '4': 10, '5': 11
}
const STOP_WORDS = new Set(['a','an','the','is','are','was','were','and','or','of','in','to','for','on','with'])

export default function StudentsPage() {
  const router = useRouter()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterGrade, setFilterGrade] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [expandedGrades, setExpandedGrades] = useState<Set<string>>(new Set())
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [importResults, setImportResults] = useState<ImportResult[]>([])
  const [showImport, setShowImport] = useState(false)
  const [csvPreview, setCsvPreview] = useState<any[]>([])
  const [csvRaw, setCsvRaw] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
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

  function parseCSV(text: string) {
    const lines = text.trim().split('\n')
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/ /g, '_'))
    return lines.slice(1).map((line) => {
      const values = line.split(',').map((v) => v.trim())
      const row: any = {}
      headers.forEach((h, i) => { row[h] = values[i] || '' })
      return row
    }).filter((r) => r.student_id)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setCsvRaw(text)
      setCsvPreview(parseCSV(text).slice(0, 5))
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (!csvRaw) return
    setImporting(true)
    setImportResults([])

    const rows = parseCSV(csvRaw)
    const results: ImportResult[] = []

    // Load class groups
    const { data: classGroups } = await supabase.from('class_groups').select('id, name')
    const classGroupMap: Record<string, string> = {}
    ;(classGroups || []).forEach((cg) => { classGroupMap[cg.name] = cg.id })

    for (const row of rows) {
      const fullName = [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ')
      const email = `${row.student_id}@${SCHOOL_DOMAIN}`

      try {
        const res = await fetch('/api/create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'student', data: row }),
        })
        const result = await res.json()
        console.log('Create user result:', res.status, JSON.stringify(result))
        if (!res.ok || result.error) {
          results.push({ name: fullName, email, status: 'failed', reason: result.error })
        } else {
          results.push({ name: fullName, email, status: 'success' })
        }
      } catch (err: any) {
        results.push({ name: fullName, email, status: 'failed', reason: err.message })
      }
    }

    setImportResults(results)
    setImporting(false)
    setCsvRaw('')
    setCsvPreview([])
    if (fileRef.current) fileRef.current.value = ''
    loadData()
  }

  if (loading) return <div>Loading…</div>

  const filtered = students.filter((s) => {
    const matchSearch = !search || s.full_name?.toLowerCase().includes(search.toLowerCase()) || s.student_id?.includes(search)
    const matchGrade = !filterGrade || s.grade_level === parseInt(filterGrade)
    const matchClass = !filterClass || s.class_name === filterClass
    return matchSearch && matchGrade && matchClass
  })

  // Get classes for selected grade
  const availableClasses = [...new Set(
    students
      .filter((s) => !filterGrade || s.grade_level === parseInt(filterGrade))
      .map((s) => s.class_name)
      .filter(Boolean)
  )].sort((a, b) => {
    const aNum = parseInt((a || '').split('-')[1] || '0')
    const bNum = parseInt((b || '').split('-')[1] || '0')
    return aNum - bNum
  })

  const successCount = importResults.filter((r) => r.status === 'success').length
  const failCount = importResults.filter((r) => r.status === 'failed').length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <p className="portal-page-title" style={{ margin: 0 }}>Students</p>
          <p className="portal-page-sub" style={{ margin: '4px 0 0' }}>{students.length} enrolled students</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowImport(!showImport)}>
          ↑ Import students
        </button>
      </div>

      {showImport && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ marginBottom: 8 }}>Import students from CSV</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            CSV format: <code>first_name, middle_name, last_name, student_id, class_id, birth_date, gender, birth_year</code>
          </p>

          <input ref={fileRef} type="file" accept=".csv" onChange={handleFileChange} style={{ marginBottom: 12 }} />

          {csvPreview.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div className="section-label" style={{ marginBottom: 8 }}>Preview (first 5 rows)</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--page-bg)' }}>
                      {Object.keys(csvPreview[0]).map((h) => (
                        <th key={h} style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--border)', fontWeight: 700, textTransform: 'uppercase', fontSize: 11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.map((row, i) => (
                      <tr key={i}>
                        {Object.values(row).map((val: any, j) => (
                          <td key={j} style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>{val}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleImport} disabled={importing || !csvRaw} className="btn btn-primary">
              {importing ? 'Importing…' : 'Import students'}
            </button>
            <button onClick={() => { setShowImport(false); setCsvPreview([]); setCsvRaw('') }} className="btn btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      {importResults.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ marginBottom: 12 }}>Import results</h2>
          <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
            <span style={{ color: 'var(--success)', fontWeight: 700 }}>✓ {successCount} imported</span>
            <span style={{ color: 'var(--danger)', fontWeight: 700 }}>✗ {failCount} failed</span>
          </div>
          {importResults.filter((r) => r.status === 'failed').map((r, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 4 }}>
              ✗ {r.name} — {r.reason}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search by name or student ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 2, minWidth: 160 }}
        />
        <select
          value={filterGrade}
          onChange={(e) => { setFilterGrade(e.target.value); setFilterClass('') }}
          style={{ flex: 1, minWidth: 120 }}
        >
          <option value="">All grades</option>
          {[7, 8, 9, 10, 11].map((g) => <option key={g} value={g}>Grade {g}</option>)}
        </select>
        <select
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
          style={{ flex: 1, minWidth: 100 }}
          disabled={availableClasses.length === 0}
        >
          <option value="">All classes</option>
          {availableClasses.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
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
            {/* Grade header */}
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
                      {/* Class header */}
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
                            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--card-bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{s.full_name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>ID: {s.student_id}</div>
                              </div>
                            </div>
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
