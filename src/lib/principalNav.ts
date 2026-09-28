import type { TourStep } from '@/components/OnboardingTour'

export const PRINCIPAL_NAV = [
  { label: 'Overview', icon: 'ti-home', href: '/principal' },
  { label: 'Alerts', icon: 'ti-bell', href: '/principal/alerts' },
  { label: 'Attendance', icon: 'ti-checklist', href: '/principal/attendance' },
  { label: 'Timetable', icon: 'ti-calendar', href: '/principal/timetable' },
  { label: 'Staff', icon: 'ti-users', href: '/principal/staff' },
  { label: 'Students', icon: 'ti-school', href: '/principal/students' },
  { label: 'Messages', icon: 'ti-message-circle', href: '/principal/messages' },
  { label: 'AI Tutor', icon: 'ti-sparkles', href: '/principal/ai-tutor' },
  { label: 'My Profile', icon: 'ti-user', href: '/principal/profile' },
]

// The first-sign-in walkthrough for the principal and vice principal (shown once, per person).
export const PRINCIPAL_TOUR_STEPS: TourStep[] = [
  { href: '/principal', title: 'Your home base', body: "This is where you land every time you sign in: today's picture of the whole school. Every card is clickable and takes you to the detail behind it." },
  { href: '/principal/alerts', title: 'Alerts', body: 'A teacher late or not started, and students at school but missing from class, show up here as they happen. The badge counts the ones you have not read yet.' },
  { href: '/principal/attendance', title: 'Attendance', body: "The live board of today's classes, the truancy report, and how reliably each teacher gets to class." },
  { href: '/principal/timetable', title: 'Timetable', body: "See the school's timetable, by class or by teacher." },
  { href: '/principal/staff', title: 'Staff', body: 'Every teacher and head of department, grouped by department. See who is online, open a teacher to see their assessments and marking, or send them a message from here.' },
  { href: '/principal/students', title: 'Students', body: 'Attendance for every student, grouped by class. Open a class to see its students, or a student for their full record.' },
  { href: '/principal/messages', title: 'Messages', body: "Message staff directly, or the whole staff group. That badge shows how many you haven't read yet." },
  { href: '/principal/ai-tutor', title: 'AI Tutor', body: 'If Smart Learning offers an AI tutor to your school, this is where you decide whether students can use it, and turn it off again at any time.' },
  { href: '/principal/profile', title: "You're all set", body: 'Your profile and password live here. That covers the essentials. Explore the rest as you go.' },
]
