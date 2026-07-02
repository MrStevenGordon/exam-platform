'use client'

import Sidebar from '@/components/Sidebar'

const TEACHER_NAV = [
  { label: 'Home', icon: 'ti-home', href: '/teacher' },
  { label: 'My Exams', icon: 'ti-file-text', href: '/teacher/exams' },
  { label: 'Grade Essays', icon: 'ti-edit', href: '/teacher/grade' },
  { label: 'Question Bank', icon: 'ti-database', href: '/teacher/bank' },
]

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="portal-layout">
      <Sidebar navItems={TEACHER_NAV} portalLabel="Teacher Portal" />
      <main className="portal-content">{children}</main>
    </div>
  )
}
