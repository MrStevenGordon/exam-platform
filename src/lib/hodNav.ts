import type { TourStep } from '@/components/OnboardingTour'

// Shared by the HOD portal layout and by the teacher-area layout, which draws
// this same shell around the pages HODs share with teachers (the exam builder
// and lesson plans), so an HOD never sees the teacher sidebar.
export const HOD_TOUR_STEPS: TourStep[] = [
  { href: '/supervisor', title: 'Your home base', body: "This is where you'll land every time you sign in, with anything waiting on you across your department." },
  { href: '/teacher/tests', title: 'Tests', body: 'You teach classes too. Create pop quizzes, class tests, and weekly tests here, exactly as a teacher does.' },
  { href: '/teacher/lesson-plans', title: 'Lesson plans', body: 'Draft and keep your own lesson plans, and browse plans shared by teachers at other schools.' },
  { href: '/supervisor/submissions', title: 'Submissions', body: 'Standardized exams your teachers submit for review land here. Approve them, or send feedback back for changes.' },
  { href: '/supervisor/final-exams', title: 'Final Exams', body: 'Once you approve an exam, publish it to classes from here and manage everything already live.' },
  { href: '/supervisor/appointments', title: 'Appointments', body: 'Assign which teachers are team leads for a subject and grade, giving them access to create standardized exams.' },
  { href: '/supervisor/analytics', title: 'Analytics', body: "See how classes performed on published exams, department-wide." },
  { href: '/supervisor/integrity', title: 'Integrity', body: 'A view into flagged exam sessions across your department, including possible AI-assisted answers.' },
  { href: '/supervisor/messages', title: 'Messages', body: "Message other staff directly, or the whole staff group. That badge shows how many you haven't read yet." },
  { href: '/supervisor/profile', title: "You're all set", body: 'Your profile, classes, and password live here. That covers the essentials. Explore the rest as you go.' },
]

export const HOD_NAV = [
  { label: 'Home', icon: 'ti-home', href: '/supervisor' },
  { label: 'Tasks', icon: 'ti-clipboard-list', href: '/teacher/tasks' },
  { label: 'Tests', icon: 'ti-file-text', href: '/teacher/tests' },
  { label: 'Lesson Plans', icon: 'ti-notebook', href: '/teacher/lesson-plans' },
  { label: 'Question Bank', icon: 'ti-database', href: '/teacher/bank' },
  { label: 'Submissions', icon: 'ti-inbox', href: '/supervisor/submissions' },
  { label: 'Final Exams', icon: 'ti-file-check', href: '/supervisor/final-exams' },
  { label: 'Appointments', icon: 'ti-award', href: '/supervisor/appointments' },
  { label: 'My Classes', icon: 'ti-users', href: '/supervisor/classes' },
  { label: 'Students', icon: 'ti-school', href: '/supervisor/students' },
  { label: 'Class Assignments', icon: 'ti-user-check', href: '/supervisor/class-assignments' },
  { label: 'Subjects', icon: 'ti-books', href: '/supervisor/subjects' },
  { label: 'Timetable', icon: 'ti-calendar', href: '/supervisor/timetable' },
  { label: 'Report Cards', icon: 'ti-report', href: '/supervisor/report-cards' },
  { label: 'Integrity', icon: 'ti-shield-exclamation', href: '/supervisor/integrity' },
  { label: 'Analytics', icon: 'ti-chart-bar', href: '/supervisor/analytics' },
  { label: 'Messages', icon: 'ti-message-circle', href: '/supervisor/messages' },
  { label: 'My Profile', icon: 'ti-user', href: '/supervisor/profile' },
]

// Pages under /teacher that HODs may also open. Everything else under
// /teacher stays teacher-only.
export const TEACHER_AREAS_OPEN_TO_HODS = ['/teacher/tasks', '/teacher/tests', '/teacher/exam', '/teacher/new', '/teacher/lesson-plans', '/teacher/bank', '/teacher/grade']

export function isOpenToHods(pathname: string): boolean {
  return TEACHER_AREAS_OPEN_TO_HODS.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

// Which HOD sidebar item to light up for a shared /teacher page that isn't
// itself a sidebar entry.
export function resolveHodActivePathname(pathname: string, searchParams: URLSearchParams): string {
  if (pathname === '/teacher/new') return searchParams.get('kind') === 'task' ? '/teacher/tasks' : '/teacher/tests'
  if (pathname.startsWith('/teacher/exam') || pathname.startsWith('/teacher/grade')) return '/teacher/tests'
  return pathname
}
