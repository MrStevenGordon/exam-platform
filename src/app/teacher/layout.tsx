'use client'

import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'

const BASE_NAV = [
  { label: 'Home', icon: 'ti-home', href: '/teacher' },
  { label: 'My Exams', icon: 'ti-file-text', href: '/teacher/exams' },
  { label: 'Question Bank', icon: 'ti-database', href: '/teacher/bank' },
  { label: 'My Classes', icon: 'ti-users', href: '/teacher/classes' },
  { label: 'My Profile', icon: 'ti-user', href: '/teacher/profile' },
]

const TEAM_LEAD_NAV = [
  { label: 'Team Lead Exams', icon: 'ti-crown', href: '/teacher/team-lead' },
]

const SENIOR_TL_NAV = [
  { label: 'Vetting', icon: 'ti-shield-check', href: '/teacher/vetting' },
]

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const [navItems, setNavItems] = useState(BASE_NAV)

  useEffect(() => {
    async function checkAppointments() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: tlData }, { data: stlData }] = await Promise.all([
        supabase.from('team_lead_appointments').select('id').eq('teacher_id', user.id).limit(1),
        supabase.from('senior_team_lead_appointments').select('id').eq('teacher_id', user.id).limit(1),
      ])

      const nav = [...BASE_NAV]
      if (tlData && tlData.length > 0) nav.splice(2, 0, ...TEAM_LEAD_NAV)
      if (stlData && stlData.length > 0) nav.splice(nav.length - 1, 0, ...SENIOR_TL_NAV)
      setNavItems(nav)
    }
    checkAppointments()
  }, [])

  return (
    <div className="portal-layout" style={{ minHeight: "100vh" }}>
      <main className="portal-content">{children}</main>
      <Sidebar navItems={navItems} portalLabel="Teacher Portal" />
    </div>
  )
}
