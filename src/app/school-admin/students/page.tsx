'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { compareClassNames, gradeLevelFromClassName } from '@/lib/classNames'
import NotifyStudentButton from '@/components/NotifyStudentButton'
import AccommodationsToggle from '@/components/AccommodationsToggle'
import CsvFormatGuide from '@/components/CsvFormatGuide'

type Student = {
  id: string
  full_name: string
  student_id: string | null
  grade_level: number | null
  class_name?: string
  school_email: string | null
  accommodations: string[]
}

type ImportResult = {
  name: string
  email: string
  status: 'success' | 'failed'
  reason?: string
  schoolEmail?: string | null
  schoolEmailWarning?: string | null
}

const SCHOOL_DOMAIN = 'mhs.smartassess'
const DEFAULT_PASSWORD = 'Student.Test'
const CLASS_TO_GRADE: Record<string, number> = {
  '1': 7, '2': 8, '3': 9, '4': 10, '5': 11
}
const STOP_WORDS = new Set(['a','an','the','is','are','was','were','and','or','of','in','to','for','on','with'])

const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }
const fieldStyle: React.CSSProperties = { width: '100%', fontWeight: 400, textTransform: 'none' }

export default function StudentsPage() {
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
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 })
  const [importResults, setImportResults] = useState<ImportResult[]>([])
  const [showImport, setShowImport] = useState(false)
  const [csvPreview, setCsvPreview] = useState<any[]>([])
  const [csvRaw, setCsvRaw] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [bulkResetting, setBulkResetting] = useState(false)
  const [showResultDetails, setShowResultDetails] = useState(false)

  // Adding one student
  const [showAddForm, setShowAddForm] = useState(false)
  const [classOptions, setClassOptions] = useState<string[]>([])
  const [addFirst, setAddFirst] = useState('')
  const [addMiddle, setAddMiddle] = useState('')
  const [addLast, setAddLast] = useState('')
  const [addStudentId, setAddStudentId] = useState('')
  const [addClass, setAddClass] = useState('')
  const [addBirthDate, setAddBirthDate] = useState('')
  const [addGender, setAddGender] = useState('')
  const [addEmail, setAddEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [addSuccess, setAddSuccess] = useState('')

  // Adding a school email to a student who has none
  const [emailEditId, setEmailEditId] = useState<string | null>(null)
  const [emailDraft, setEmailDraft] = useState('')
  const [emailError, setEmailError] = useState('')

  useEffect(() => { loadData() }, [])

  // Arriving from a link such as /school-admin/students?class=3-1 (the class chips in Settings): show that class,
  // opened, with its grade filter set. Read once from the address; the filters work as usual afterwards.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('class')
    if (!wanted) return
    const grade = gradeLevelFromClassName(wanted)
    setFilterClass(wanted)
    if (grade) {
      setFilterGrade(String(grade))
      setExpandedGrades(new Set([`grade-${grade}`]))
      setExpandedClasses(new Set([`class-${grade}-${wanted}`]))
    }
  }, [])

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
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, student_id, grade_level, school_email, accommodations, enrollments(class_groups(name))')
        .eq('role', 'student')
        .order('grade_level', { ascending: true })

      const mapped = (data || []).map((s: any) => ({
        id: s.id,
        full_name: s.full_name,
        student_id: s.student_id,
        grade_level: s.grade_level,
        class_name: s.enrollments?.[0]?.class_groups?.name || null,
        school_email: s.school_email,
        accommodations: Array.isArray(s.accommodations) ? s.accommodations : [],
      }))
      setStudents(mapped)
      const { data: groups } = await supabase.from('class_groups').select('name')
      setClassOptions((groups || []).map((g: { name: string }) => g.name).sort(compareClassNames))
    } catch (err) {
      console.error('Failed to load students', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleResetStudentPassword(studentId: string, name: string) {
    if (!confirm(`Reset ${name}'s password to "Student.Test"?`)) return
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'reset-password', data: { user_id: studentId, password: 'Student.Test' }, accessToken: session?.access_token })
    })
    const result = await res.json()
    if (result.error) alert('Error: ' + result.error)
    else alert('Password reset to "Student.Test". Student must change it on next login.')
  }

  async function handleResetAllStudentPasswords() {
    const first = confirm(`Reset ALL ${students.length} student passwords to "Student.Test"?`)
    if (!first) return
    const second = confirm(`Are you sure? This cannot be undone, and every student will need to log in and change their password.`)
    if (!second) return

    setBulkResetting(true)
    let success = 0
    let failed = 0
    const errors: string[] = []
    const { data: { session } } = await supabase.auth.getSession()
    for (const s of students) {
      const res = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'reset-password', data: { user_id: s.id, password: 'Student.Test' }, accessToken: session?.access_token })
      })
      const result = await res.json()
      if (result.error) {
        failed++
        console.error(`Reset failed for ${s.full_name} (${s.id}):`, result.error)
        if (errors.length < 3) errors.push(`${s.full_name}: ${result.error}`)
      } else {
        success++
      }
    }
    setBulkResetting(false)
    alert(`Done. ${success} reset, ${failed} failed, out of ${students.length} students.${errors.length ? '\n\nSample errors:\n' + errors.join('\n') : ''}`)
  }

  async function handleAddStudent(e: React.FormEvent) {
    e.preventDefault()
    setAddError('')
    setAddSuccess('')
    if (!addFirst.trim() || !addLast.trim() || !addStudentId.trim() || !addClass) {
      setAddError('First name, last name, student ID and class are all required.')
      return
    }
    setAdding(true)
    const { data: { session } } = await supabase.auth.getSession()
    const birthYear = addBirthDate ? addBirthDate.slice(0, 4) : ''
    try {
      const res = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'student',
          data: {
            first_name: addFirst.trim(),
            ...(addMiddle.trim() ? { middle_name: addMiddle.trim() } : {}),
            last_name: addLast.trim(),
            student_id: addStudentId.trim(),
            class_id: addClass,
            ...(addBirthDate ? { birth_date: addBirthDate, birth_year: birthYear } : {}),
            ...(addGender ? { gender: addGender } : {}),
            school_email: addEmail.trim(),
          },
          accessToken: session?.access_token,
        }),
      })
      const result = await res.json()
      if (!res.ok || result.error) {
        setAddError(result.error || 'The student could not be added.')
      } else {
        setAddSuccess(`${addFirst.trim()} ${addLast.trim()} was added to ${addClass}. Sign-in: ${result.email} with the starting password Student.Test.${result.schoolEmailWarning ? ` Note: ${result.schoolEmailWarning}` : ''}`)
        setAddFirst(''); setAddMiddle(''); setAddLast(''); setAddStudentId(''); setAddBirthDate(''); setAddGender(''); setAddEmail('')
        loadData()
      }
    } catch {
      setAddError('Could not reach the server. Check your connection and try again.')
    }
    setAdding(false)
  }

  async function handleSaveSchoolEmail(studentId: string) {
    const value = emailDraft.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) { setEmailError('Enter a full email address, such as name@stu.mhs.edu.jm.'); return }
    setEmailError('')
    const { error } = await supabase.from('profiles').update({ school_email: value }).eq('id', studentId)
    if (error) { setEmailError(error.message); return }
    setEmailEditId(null)
    setEmailDraft('')
    loadData()
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
    setImportProgress({ done: 0, total: rows.length })

    // Load class groups
    const { data: classGroups } = await supabase.from('class_groups').select('id, name')
    const classGroupMap: Record<string, string> = {}
    ;(classGroups || []).forEach((cg) => { classGroupMap[cg.name] = cg.id })
    const { data: { session } } = await supabase.auth.getSession()

    for (const row of rows) {
      const fullName = [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ')
      const email = `${row.student_id}@${SCHOOL_DOMAIN}`
      const { email: rowSchoolEmail, ...rowRest } = row
      const payload = { ...rowRest, school_email: rowSchoolEmail || undefined }

      try {
        const res = await fetch('/api/create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'student', data: payload, accessToken: session?.access_token }),
        })
        const result = await res.json()
        console.log('Create user result:', res.status, JSON.stringify(result))
        if (!res.ok || result.error) {
          results.push({ name: fullName, email, status: 'failed', reason: result.error })
        } else {
          results.push({ name: fullName, email, status: 'success', schoolEmail: result.schoolEmail, schoolEmailWarning: result.schoolEmailWarning })
        }
      } catch (err: any) {
        results.push({ name: fullName, email, status: 'failed', reason: err.message })
      }
      setImportProgress((prev) => ({ ...prev, done: prev.done + 1 }))
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

  // All classes that actually have students, grouped by grade, for the
  // combined class filter dropdown (Grade 7 > 1-1, 1-2... / Grade 8 > 2-1...)
  const classesByGrade: Record<number, string[]> = {}
  students.forEach((s) => {
    if (!s.class_name || !s.grade_level) return
    if (!classesByGrade[s.grade_level]) classesByGrade[s.grade_level] = []
    if (!classesByGrade[s.grade_level].includes(s.class_name)) classesByGrade[s.grade_level].push(s.class_name)
  })
  Object.keys(classesByGrade).forEach((g) => {
    classesByGrade[parseInt(g)].sort((a, b) => compareClassNames(a, b))
  })

  // Which grade a given class belongs to, for setting filterGrade when a
  // specific class is picked from the combined dropdown.
  const gradeForClass: Record<string, number> = {}
  Object.entries(classesByGrade).forEach(([g, classes]) => {
    classes.forEach((c) => { gradeForClass[c] = parseInt(g) })
  })

  const successCount = importResults.filter((r) => r.status === 'success').length
  const failCount = importResults.filter((r) => r.status === 'failed').length
  const noEmailCount = importResults.filter((r) => r.schoolEmailWarning).length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <p className="portal-page-title" style={{ margin: 0 }}>Students</p>
          <p className="portal-page-sub" style={{ margin: '4px 0 0' }}>{students.length} enrolled students</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => { setShowAddForm(!showAddForm); setShowImport(false); setAddError(''); setAddSuccess('') }}>
            + Add student
          </button>
          <button className="btn btn-secondary" onClick={() => { setShowImport(!showImport); setShowAddForm(false) }}>
            ↑ Import from CSV
          </button>
          <button className="btn btn-secondary" onClick={handleResetAllStudentPasswords} disabled={bulkResetting}>
            {bulkResetting ? 'Resetting…' : 'Reset all passwords'}
          </button>
        </div>
      </div>

      {addSuccess && !showAddForm && <div className="banner banner-success" style={{ marginBottom: 16 }}>{addSuccess}</div>}

      {showAddForm && (
        <form onSubmit={handleAddStudent} className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ marginBottom: 4 }}>Add a student</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px' }}>
            Their class decides their grade. Their sign-in is their student ID followed by @mhs.smartassess, with the starting password Student.Test.
          </p>
          {addError && <div className="banner banner-danger" role="alert" style={{ marginBottom: 12 }}>{addError}</div>}
          {addSuccess && <div className="banner banner-success" style={{ marginBottom: 12 }}>{addSuccess}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
            <label style={labelStyle}>First name *<input value={addFirst} onChange={(e) => setAddFirst(e.target.value)} style={fieldStyle} maxLength={100} /></label>
            <label style={labelStyle}>Middle name<input value={addMiddle} onChange={(e) => setAddMiddle(e.target.value)} style={fieldStyle} maxLength={100} /></label>
            <label style={labelStyle}>Last name *<input value={addLast} onChange={(e) => setAddLast(e.target.value)} style={fieldStyle} maxLength={100} /></label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
            <label style={labelStyle}>Student ID *<input value={addStudentId} onChange={(e) => setAddStudentId(e.target.value)} style={fieldStyle} maxLength={50} inputMode="numeric" /></label>
            <label style={labelStyle}>Class *
              <select value={addClass} onChange={(e) => setAddClass(e.target.value)} style={fieldStyle}>
                <option value="">Choose a class…</option>
                {classOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label style={labelStyle}>Date of birth<input type="date" value={addBirthDate} onChange={(e) => setAddBirthDate(e.target.value)} style={fieldStyle} /></label>
            <label style={labelStyle}>Gender
              <select value={addGender} onChange={(e) => setAddGender(e.target.value)} style={fieldStyle}>
                <option value="">Not stated</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </label>
          </div>
          <label style={{ ...labelStyle, marginBottom: 16, display: 'block' }}>School email (optional)
            <input type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} style={fieldStyle} placeholder="Leave blank to generate one from their name" />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={adding} className="btn btn-primary">{adding ? 'Adding…' : 'Add student'}</button>
            <button type="button" onClick={() => setShowAddForm(false)} className="btn btn-ghost">Close</button>
          </div>
        </form>
      )}

      {showImport && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ marginBottom: 8 }}>Import students from CSV</h2>
          <CsvFormatGuide
            templateHref="/templates/students-template.csv"
            templateName="students-template.csv"
            columns={[
              { name: 'first_name', required: true, description: 'First name', example: 'Amara' },
              { name: 'middle_name', required: false, description: 'Middle name, or leave empty', example: 'Joy' },
              { name: 'last_name', required: true, description: 'Last name', example: 'Campbell' },
              { name: 'student_id', required: true, description: 'Their student ID number. This is their sign-in', example: '250123' },
              { name: 'class_id', required: true, description: 'The class name, exactly as it appears in the school (it decides the grade)', example: '3-1' },
              { name: 'birth_date', required: false, description: 'Year-month-day', example: '2011-09-03' },
              { name: 'gender', required: false, description: 'M or F', example: 'F' },
              { name: 'birth_year', required: false, description: 'Four-digit year', example: '2011' },
              { name: 'email', required: false, description: "The student's real school inbox. Leave empty to generate one from their name", example: 'amara.campbell@stu.mhs.edu.jm' },
            ]}
            notes={[
              'Each student signs in with their student ID followed by @mhs.smartassess, and the starting password Student.Test.',
              'If two students would get the same generated school email, the second is left blank on purpose (guessing could send their sign-in details to the wrong person). You can add it afterwards from the student list.',
            ]}
          />

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

          {importing && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                <span>Importing {importProgress.done} of {importProgress.total}</span>
                <span>{importProgress.total > 0 ? Math.round((importProgress.done / importProgress.total) * 100) : 0}%</span>
              </div>
              <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${importProgress.total > 0 ? (importProgress.done / importProgress.total) * 100 : 0}%`,
                  background: 'var(--accent)',
                  transition: 'width 0.2s ease',
                }} />
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
          <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--success)', fontWeight: 700 }}>✓ {successCount} imported</span>
            <span style={{ color: failCount ? 'var(--danger)' : 'var(--text-secondary)', fontWeight: 700 }}>✗ {failCount} failed</span>
            {noEmailCount > 0 && <span style={{ color: 'var(--warning)', fontWeight: 700 }}>⚠ {noEmailCount} without a school email</span>}
          </div>
          {failCount > 0 && importResults.filter((r) => r.status === 'failed').map((r, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 4 }}>
              ✗ {r.name} · {r.reason}
            </div>
          ))}
          {noEmailCount > 0 && (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              <p style={{ margin: '0 0 8px' }}>
                These students were added, but the school email that would be generated from their name is already used by another student, so it was left blank. Add theirs from the student list below (each one shows an &quot;Add school email&quot; button).
              </p>
              <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowResultDetails(!showResultDetails)}>
                {showResultDetails ? 'Hide the list' : `Show the ${noEmailCount} students`}
              </button>
              {showResultDetails && (
                <ul style={{ margin: '8px 0 0', paddingLeft: 18, columns: 2, fontSize: 12 }}>
                  {importResults.filter((r) => r.schoolEmailWarning).map((r, i) => <li key={i}>{r.name}</li>)}
                </ul>
              )}
            </div>
          )}
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
              {[7, 8, 9, 10, 11, 12].map((g) => {
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

      {[7, 8, 9, 10, 11, 12].map((grade) => {
        const gradeStudents = filtered.filter((s) => s.grade_level === grade)
        if (gradeStudents.length === 0) return null
        const classes = [...new Set(gradeStudents.map((s) => s.class_name).filter(Boolean))].sort((a, b) => compareClassNames(a, b))

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
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                                  ID: {s.student_id}
                                  {s.school_email ? ` · ${s.school_email}` : ' · No school email on file'}
                                </div>
                                {!s.school_email && emailEditId === s.id && (
                                  <div style={{ marginTop: 6 }}>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                      <input
                                        type="email"
                                        value={emailDraft}
                                        onChange={(e) => setEmailDraft(e.target.value)}
                                        placeholder="name@stu.mhs.edu.jm"
                                        autoFocus
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveSchoolEmail(s.id) }}
                                        style={{ fontSize: 12, padding: '4px 8px', width: 240 }}
                                      />
                                      <button className="btn btn-primary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => handleSaveSchoolEmail(s.id)}>Save</button>
                                      <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => { setEmailEditId(null); setEmailError('') }}>Cancel</button>
                                    </div>
                                    {emailError && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>{emailError}</div>}
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: 6 }}>
                                {!s.school_email && emailEditId !== s.id && (
                                  <button onClick={() => { setEmailEditId(s.id); setEmailDraft(''); setEmailError('') }} className="btn btn-ghost" style={{ fontSize: 11 }}>
                                    Add school email
                                  </button>
                                )}
                                <AccommodationsToggle studentId={s.id} initialEnabled={s.accommodations.includes('text_to_speech')} />
                                <NotifyStudentButton studentId={s.id} studentName={s.full_name} />
                                <button onClick={() => handleResetStudentPassword(s.id, s.full_name)} className="btn btn-ghost" style={{ fontSize: 11 }}>
                                  Reset password
                                </button>
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
