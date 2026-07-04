'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function SettingsPage() {
  const [classGroups, setClassGroups] = useState<{ id: string; name: string; year_grade: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('class_groups')
        .select('id, name, year_grade')
        .order('year_grade', { ascending: true })
      setClassGroups(data || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div>Loading…</div>

  const grades = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11']

  return (
    <div>
      <p className="portal-page-title">School Settings</p>
      <p className="portal-page-sub">Manchester High School · Academic year 2026–2027</p>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginBottom: 12 }}>School information</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'School name', value: 'Manchester High School' },
            { label: 'Email domain', value: 'mhs.smartassess' },
            { label: 'Academic year', value: '2026–2027' },
            { label: 'Platform', value: 'Smart Assess Ja' },
          ].map((item) => (
            <div key={item.label}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{item.label}</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 12 }}>Class groups ({classGroups.length} total)</h2>
        {grades.map((grade) => {
          const gradeClasses = classGroups.filter((cg) => cg.year_grade === grade)
          if (gradeClasses.length === 0) return null
          return (
            <div key={grade} style={{ marginBottom: 16 }}>
              <div className="section-label" style={{ marginBottom: 8 }}>{grade}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
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
