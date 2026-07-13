'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function SchoolAdminHome() {
  const router = useRouter()
  const [stats, setStats] = useState({
    totalStaff: 0,
    totalStudents: 0,
    flaggedSessions: 0,
    activeExams: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_system_admin, role')
        .eq('id', user.id)
        .single()

      if (!profile?.is_system_admin && profile?.role !== 'admin') {
        router.push('/login')
        return
      }

      const [
        { count: staffCount },
        { count: studentCount },
        { count: flaggedCount },
        { count: finalExamCount },
        { count: directExamCount },
      ] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).in('role', ['teacher', 'supervisor']),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
        supabase.from('exam_sessions').select('id', { count: 'exact', head: true }).eq('flagged', true),
        supabase.from('final_exams').select('id', { count: 'exact', head: true }).eq('status', 'published'),
        supabase.from('draft_exams').select('id', { count: 'exact', head: true }).eq('direct_published', true),
      ])

      setStats({
        totalStaff: staffCount || 0,
        totalStudents: studentCount || 0,
        flaggedSessions: flaggedCount || 0,
        activeExams: (finalExamCount || 0) + (directExamCount || 0),
      })
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return <div>Loading…</div>

  return (
    <div>
      <p className="portal-page-title">School Overview</p>
      <p className="portal-page-sub">Manchester High School · Academic year 2026–2027</p>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card-value">{stats.totalStaff}</div>
          <div className="stat-card-label">Staff accounts</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value">{stats.totalStudents}</div>
          <div className="stat-card-label">Students</div>
        </div>
        <div className={`stat-card ${stats.flaggedSessions > 0 ? 'stat-card-danger' : 'stat-card-success'}`}>
          <div className="stat-card-value">{stats.flaggedSessions}</div>
          <div className="stat-card-label">Flagged sessions</div>
        </div>
        <div className="stat-card stat-card-accent">
          <div className="stat-card-value">{stats.activeExams}</div>
          <div className="stat-card-label">Active exams</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
        {[
          { href: '/school-admin/staff', icon: '👥', title: 'Manage Staff', desc: 'Add teachers, deactivate accounts, view all staff' },
          { href: '/school-admin/students', icon: '🎓', title: 'Manage Students', desc: 'Upload student data, view enrollments, manage classes' },
          { href: '/school-admin/activity', icon: '📊', title: 'Activity Monitor', desc: 'Flagged sessions, login activity, exam completions' },
          { href: '/school-admin/settings', icon: '⚙️', title: 'School Settings', desc: 'Academic year, class groups, school information' },
        ].map((item) => (
          <Link key={item.href} href={item.href} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="card card-clickable">
              <div style={{ fontSize: 28, marginBottom: 10 }}>{item.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{item.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
