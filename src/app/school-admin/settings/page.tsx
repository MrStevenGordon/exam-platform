'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function SettingsPage() {
  const [classGroups, setClassGroups] = useState<{ id: string; name: string; year_grade: string }[]>([])
  const [stats, setStats] = useState({ students: 0, staff: 0, departments: 0, exams: 0 })
  const [loading, setLoading] = useState(true)
  const [settingsId, setSettingsId] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoError, setLogoError] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('class_groups').select('id, name, year_grade').order('year_grade')
      setClassGroups(data || [])

      const { data: settingsRow } = await supabase.from('school_settings').select('id, logo_url').limit(1).single()
      if (settingsRow) {
        setSettingsId(settingsRow.id)
        setLogoUrl(settingsRow.logo_url)
      }

      const [
        { count: students },
        { count: staff },
        { count: departments },
        { count: finalExams },
        { count: directExams },
      ] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).in('role', ['teacher', 'supervisor']),
        supabase.from('departments').select('id', { count: 'exact', head: true }),
        supabase.from('final_exams').select('id', { count: 'exact', head: true }),
        supabase.from('draft_exams').select('id', { count: 'exact', head: true }).eq('direct_published', true),
      ])

      setStats({ students: students || 0, staff: staff || 0, departments: departments || 0, exams: (finalExams || 0) + (directExams || 0) })
      setLoading(false)
    }
    load()
  }, [])

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !settingsId) return

    setUploadingLogo(true)
    setLogoError('')

    const ext = file.name.split('.').pop()
    const path = `logo-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage.from('school-logo').upload(path, file, { upsert: true })
    if (uploadError) {
      setLogoError(uploadError.message)
      setUploadingLogo(false)
      return
    }

    const { data: publicUrlData } = supabase.storage.from('school-logo').getPublicUrl(path)
    const newUrl = publicUrlData.publicUrl

    const { error: updateError } = await supabase.from('school_settings').update({ logo_url: newUrl }).eq('id', settingsId)
    if (updateError) {
      setLogoError(updateError.message)
      setUploadingLogo(false)
      return
    }

    setLogoUrl(newUrl)
    setUploadingLogo(false)
  }

  if (loading) return <div>Loading…</div>

  const grades = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11']

  return (
    <div>
      <p className="portal-page-title">School Settings</p>
      <p className="portal-page-sub">Manchester High School · Academic year 2026–2027</p>

      {/* School branding */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginBottom: 16 }}>School branding</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 12, border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--page-bg)', overflow: 'hidden', flexShrink: 0,
          }}>
            {logoUrl ? (
              <img src={logoUrl} alt="School logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <span style={{ fontSize: 24 }}>🏫</span>
            )}
          </div>
          <div>
            <label className="btn btn-secondary" style={{ cursor: 'pointer', display: 'inline-block' }}>
              {uploadingLogo ? 'Uploading…' : logoUrl ? 'Change logo' : 'Upload logo'}
              <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} style={{ display: 'none' }} />
            </label>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
              Shown across every portal. PNG or JPG recommended.
            </p>
            {logoError && <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{logoError}</p>}
          </div>
        </div>
      </div>

      {/* School info */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginBottom: 16 }}>School information</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[
            { label: 'School name', value: 'Manchester High School' },
            { label: 'Email domain', value: '@mhs.smartassess' },
            { label: 'Academic year', value: '2026–2027' },
            { label: 'Student default password', value: 'Student.Test' },
            { label: 'Staff default password', value: 'Staff.Default1' },
            { label: 'Platform', value: 'Smart Assess Ja' },
          ].map((item) => (
            <div key={item.label} style={{ padding: '10px 12px', background: 'var(--page-bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{item.label}</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick stats */}
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card"><div className="stat-card-value">{stats.students}</div><div className="stat-card-label">Students</div></div>
        <div className="stat-card"><div className="stat-card-value">{stats.staff}</div><div className="stat-card-label">Staff</div></div>
        <div className="stat-card"><div className="stat-card-value">{stats.departments}</div><div className="stat-card-label">Departments</div></div>
        <div className="stat-card"><div className="stat-card-value">{stats.exams}</div><div className="stat-card-label">Published exams</div></div>
      </div>

      {/* Class groups */}
      <div className="card">
        <h2 style={{ marginBottom: 16 }}>Class groups ({classGroups.length} total)</h2>
        {grades.map((grade) => {
          const gradeClasses = classGroups
            .filter((cg) => cg.year_grade === grade)
            .sort((a, b) => {
              const aNum = parseInt((a.name || '').split('-')[1] || '0')
              const bNum = parseInt((b.name || '').split('-')[1] || '0')
              return aNum - bNum
            })
          if (gradeClasses.length === 0) return null
          return (
            <div key={grade} style={{ marginBottom: 16 }}>
              <div className="section-label" style={{ marginBottom: 8 }}>{grade} — {gradeClasses.length} classes</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {gradeClasses.map((cg) => (
                  <span key={cg.id} className="badge badge-default">{cg.name}</span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
