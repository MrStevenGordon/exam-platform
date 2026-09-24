import type { TourStep } from '@/components/OnboardingTour'

// Shared by the HOD portal layout and by the teacher-area layout, which draws
// this same shell around the pages HODs share with teachers (the exam builder
// and lesson plans), so an HOD never sees the teacher sidebar.
export const HOD_TOUR_STEPS: TourStep[] = [
  { href: '/supervisor', title: 'Your home base', body: "This is where you'll land every time you sign in, with anything waiting on you across your department." },
  { href: '/teacher/tests', title: 'Tests', body: 'You teach classes too. Create pop quizzes, class tests, and weekly tests here, exactly as a teacher does.' },
  { href: '/teacher/lesson-plans', title: 'Lesson plans', body: 'Draft and keep your own lesson plans, and browse plans shared by teachers at other schools.' },
  { href: '/supervisor/final-exams', title: 'Final Exams', body: 'Everything about standardized exams in one place: publish approved exams to classes, review what teachers submit, and appoint team leads.' },
  { href: '/supervisor/classrooms', title: 'Classrooms', body: 'Your classes, your students, and which teacher takes which class, all under one roof.' },
  { href: '/supervisor/analytics', title: 'Analytics', body: 'See how classes performed on published exams, and review flagged sessions, including possible AI-assisted answers, on the Integrity tab.' },
  { href: '/supervisor/messages', title: 'Messages', body: "Message other staff directly, or the whole staff group. That badge shows how many you haven't read yet." },
  { href: '/supervisor/profile', title: "You're all set", body: 'Your profile, classes, and password live here. That covers the essentials. Explore the rest as you go.' },
]

export const HOD_NAV = [
  { label: 'Home', icon: 'ti-home', href: '/supervisor' },
  { label: 'Tasks', icon: 'ti-clipboard-list', href: '/teacher/tasks' },
  { label: 'Tests', icon: 'ti-file-text', href: '/teacher/tests' },
  { label: 'Lesson Plans', icon: 'ti-notebook', href: '/teacher/lesson-plans' },
  { label: 'Question Bank', icon: 'ti-database', href: '/teacher/bank' },
  { label: 'Final Exams', icon: 'ti-file-check', href: '/supervisor/final-exams' },
  { label: 'Classrooms', icon: 'ti-users', href: '/supervisor/classrooms' },
  { label: 'Subjects', icon: 'ti-books', href: '/supervisor/subjects' },
  { label: 'Timetable', icon: 'ti-calendar', href: '/supervisor/timetable' },
  { label: 'Report Cards', icon: 'ti-report', href: '/supervisor/report-cards' },
  { label: 'Analytics', icon: 'ti-chart-bar', href: '/supervisor/analytics' },
  { label: 'Messages', icon: 'ti-message-circle', href: '/supervisor/messages' },
  { label: 'My Profile', icon: 'ti-user', href: '/supervisor/profile' },
]

// HODs teach classes too, so once attendance is installed they get the same
// Attendance page teachers use (register, Start class, roll call).
export function hodNavItems(attendanceOn: boolean) {
  if (!attendanceOn) return HOD_NAV
  const i = HOD_NAV.findIndex((n) => n.href === '/supervisor/timetable')
  return [...HOD_NAV.slice(0, i + 1), { label: 'Attendance', icon: 'ti-checklist', href: '/teacher/attendance' }, ...HOD_NAV.slice(i + 1)]
}

// Pages under /teacher that HODs may also open. Everything else under
// /teacher stays teacher-only.
export const TEACHER_AREAS_OPEN_TO_HODS = ['/teacher/tasks', '/teacher/tests', '/teacher/exam', '/teacher/new', '/teacher/lesson-plans', '/teacher/bank', '/teacher/grade', '/teacher/attendance']

export function isOpenToHods(pathname: string): boolean {
  return TEACHER_AREAS_OPEN_TO_HODS.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

// Which HOD sidebar item to light up for a shared /teacher page that isn't
// itself a sidebar entry.
export function resolveHodActivePathname(pathname: string, searchParams: URLSearchParams): string {
  if (pathname === '/teacher/new') return searchParams.get('kind') === 'task' ? '/teacher/tasks' : '/teacher/tests'
  if (pathname.startsWith('/teacher/exam') || pathname.startsWith('/teacher/grade')) return '/teacher/tests'
  // Detail pages that belong to a merged section light up that section.
  if (pathname.startsWith('/supervisor/exam/')) return '/supervisor/final-exams'
  if (pathname.startsWith('/supervisor/student/')) return '/supervisor/classrooms'
  return pathname
}
