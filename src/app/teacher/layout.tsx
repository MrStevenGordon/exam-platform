'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import PageTransition from '@/components/PageTransition'
import InactivityLogout from '@/components/InactivityLogout'
import { supabase } from '@/lib/supabase'
import { getMfaRedirect } from '@/lib/mfaCheck'
import { verifyPortalRole } from '@/lib/verifyPortalRole'
import { getSchoolFeatures } from '@/lib/schoolFeatures'

const BASE_NAV = [
  { label: 'Home', icon: 'ti-home', href: '/teacher' },
  { label: 'Tasks', icon: 'ti-clipboard-list', href: '/teacher/tasks' },
  { label: 'Tests', icon: 'ti-file-text', href: '/teacher/tests' },
  { label: 'Folder', icon: 'ti-folder', href: '/teacher/folder' },
  { label: 'Question Bank', icon: 'ti-database', href: '/teacher/bank' },
  { label: 'My Classes', icon: 'ti-users', href: '/teacher/classes' },
  { label: 'Timetable', icon: 'ti-calendar', href: '/teacher/timetable' },
  { label: 'Messages', icon: 'ti-message-circle', href: '/teacher/messages' },
  { label: 'My Profile', icon: 'ti-user', href: '/teacher/profile' },
]

const TEAM_LEAD_NAV = [
  { label: 'Team Lead Exams', icon: 'ti-crown', href: '/teacher/team-lead' },
]

const SENIOR_TL_NAV = [
  { label: 'Vetting', icon: 'ti-shield-check', href: '/teacher/vetting' },
]

// /teacher/new?kind=task|test is a shared creation page outside both
// /teacher/tasks and /teacher/tests, so it needs an explicit mapping back
// to whichever section it was launched from.
function resolveActivePathname(pathname: string, searchParams: URLSearchParams) {
  if (pathname === '/teacher/new') {
    const kind = searchParams.get('kind')
    if (kind === 'task') return '/teacher/tasks'
    if (kind === 'test') return '/teacher/tests'
  }
  return pathname
}

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [navItems, setNavItems] = useState(BASE_NAV)
  const [mfaChecked, setMfaChecked] = useState(false)

  useEffect(() => {
    async function checkAccess() {
      const roleRedirect = await verifyPortalRole('teacher')
      if (roleRedirect) { router.push(roleRedirect); return }
      const mfaRedirect = await getMfaRedirect('teacher')
      if (mfaRedirect) { router.push(`${mfaRedirect}?from=${encodeURIComponent(pathname)}`); return }
      setMfaChecked(true)
    }
    checkAccess()
  }, [router, pathname])

  useEffect(() => {
    if (!mfaChecked) return
    async function checkAppointments() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const features = await getSchoolFeatures()

      let tlData: any[] | null = null
      let stlData: any[] | null = null

      if (features.teamLeadsEnabled) {
        try {
          const res = await supabase.from('team_lead_appointments').select('id').eq('teacher_id', user.id).limit(1)
          if (res.error) console.error('team_lead_appointments check failed:', res.error)
          tlData = res.data
        } catch (e) {
          console.error('team_lead_appointments check threw:', e)
        }
      }

      if (features.seniorTeamLeadsEnabled) {
        try {
          const res = await supabase.from('senior_team_lead_appointments').select('id').eq('teacher_id', user.id).limit(1)
          if (res.error) console.error('senior_team_lead_appointments check failed:', res.error)
          stlData = res.data
        } catch (e) {
          console.error('senior_team_lead_appointments check threw:', e)
        }
      }

      const nav = [...BASE_NAV]
      if (tlData && tlData.length > 0) nav.splice(4, 0, ...TEAM_LEAD_NAV)
      if (stlData && stlData.length > 0) nav.splice(nav.length - 1, 0, ...SENIOR_TL_NAV)
      setNavItems(nav)
    }
    checkAppointments()
  }, [mfaChecked])

  if (!mfaChecked) return null

  return (
    <div className="portal-layout" style={{ minHeight: "100vh" }}>
      <InactivityLogout />
      <main className="portal-content"><PageTransition>{children}</PageTransition></main>
      <Sidebar navItems={navItems} portalLabel="Teacher Portal" resolveActivePathname={resolveActivePathname} />
    </div>
  )
}
