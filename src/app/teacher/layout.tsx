'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import PageTransition from '@/components/PageTransition'
import InactivityLogout from '@/components/InactivityLogout'
import OnboardingTour, { TourStep } from '@/components/OnboardingTour'
import { supabase } from '@/lib/supabase'
import { getMfaRedirect } from '@/lib/mfaCheck'
import { verifyPortalRole } from '@/lib/verifyPortalRole'
import { getSchoolFeatures } from '@/lib/schoolFeatures'

// Only the highest-value stops, not every nav item: a tour that spotlights
// all 12 possible items is a chore, not an orientation. Team Lead Exams and
// Lesson Plans are conditional nav items (see BASE_NAV/checkAppointments
// below); OnboardingTour itself skips any step whose target isn't actually
// on the page for this teacher.
const TEACHER_TOUR_STEPS: TourStep[] = [
  { href: '/teacher', title: 'Your home base', body: "This is where you'll land every time you sign in: a quick view of what needs your attention across your classes." },
  { href: '/teacher/tests', title: 'Create exams and quizzes', body: 'Build a pop quiz, class test, or weekly test here. It publishes straight to your classes, no approval step needed.' },
  { href: '/teacher/bank', title: 'Question bank', body: "Save a question once and reuse it in future exams instead of writing it again. It's yours to draw from whenever you're building a new test." },
  { href: '/teacher/classes', title: 'My Classes', body: 'Your rosters, grouped by grade. See who\'s enrolled in each class you teach.' },
  { href: '/teacher/team-lead', title: 'Team Lead Exams', body: 'As a team lead, standardized exams (monthly, midterm, end of term) you create here go to your supervisor for review before publishing.' },
  { href: '/teacher/lesson-plans', title: 'Lesson plans', body: "Draft a full lesson plan from a subject, grade, and topic with one click. Included free with your account, and shareable with other teachers." },
  { href: '/teacher/messages', title: 'Messages', body: "Message other staff directly, or the whole staff group. That badge shows how many you haven't read yet." },
  { href: '/teacher/profile', title: "You're all set", body: 'Your profile and password live here. That covers the essentials. Explore the rest as you go.' },
]

const BASE_NAV = [
  { label: 'Home', icon: 'ti-home', href: '/teacher' },
  { label: 'Tasks', icon: 'ti-clipboard-list', href: '/teacher/tasks' },
  { label: 'Tests', icon: 'ti-file-text', href: '/teacher/tests' },
  { label: 'Folder', icon: 'ti-folder', href: '/teacher/folder' },
  { label: 'Question Bank', icon: 'ti-database', href: '/teacher/bank' },
  { label: 'My Classes', icon: 'ti-users', href: '/teacher/classes' },
  { label: 'Timetable', icon: 'ti-calendar', href: '/teacher/timetable' },
  { label: 'Report Cards', icon: 'ti-report', href: '/teacher/report-cards' },
  { label: 'Messages', icon: 'ti-message-circle', href: '/teacher/messages' },
  { label: 'My Profile', icon: 'ti-user', href: '/teacher/profile' },
]

const LESSON_PLANS_NAV = [
  { label: 'Lesson Plans', icon: 'ti-notebook', href: '/teacher/lesson-plans' },
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
  const [navReady, setNavReady] = useState(false)

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
      if (features.lessonPlanLibraryEnabled) nav.splice(nav.indexOf(BASE_NAV[7]) + 1, 0, ...LESSON_PLANS_NAV)
      if (stlData && stlData.length > 0) nav.splice(nav.length - 1, 0, ...SENIOR_TL_NAV)
      setNavItems(nav)
      setNavReady(true)
    }
    checkAppointments()
  }, [mfaChecked])

  if (!mfaChecked) return null

  return (
    <div className="portal-layout" style={{ minHeight: "100vh" }}>
      <InactivityLogout />
      <main className="portal-content"><PageTransition>{children}</PageTransition></main>
      <Sidebar navItems={navItems} portalLabel="Teacher Portal" resolveActivePathname={resolveActivePathname} />
      {navReady && <OnboardingTour tourKey="teacher" steps={TEACHER_TOUR_STEPS} />}
    </div>
  )
}
