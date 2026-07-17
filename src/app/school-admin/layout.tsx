'use client'

import Sidebar from '@/components/Sidebar'

const SCHOOL_ADMIN_NAV = [
  { label: 'Overview', icon: 'ti-home', href: '/school-admin' },
  { label: 'Departments', icon: 'ti-building', href: '/school-admin/departments' },
  { label: 'Subjects', icon: 'ti-book', href: '/school-admin/subjects' },
  { label: 'Routing Check', icon: 'ti-route', href: '/school-admin/routing-check' },
  { label: 'Staff', icon: 'ti-users', href: '/school-admin/staff' },
  { label: 'Students', icon: 'ti-school', href: '/school-admin/students' },
  { label: 'Password requests', icon: 'ti-key', href: '/school-admin/password-requests' },
  { label: 'Analytics', icon: 'ti-chart-bar', href: '/school-admin/analytics' },
  { label: 'Activity', icon: 'ti-activity', href: '/school-admin/activity' },
  { label: 'Settings', icon: 'ti-settings', href: '/school-admin/settings' },
  { label: 'My Profile', icon: 'ti-user', href: '/school-admin/profile' },
]

export default function SchoolAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="portal-layout" style={{ minHeight: "100vh" }}>
      <main className="portal-content">{children}</main>
      <Sidebar navItems={SCHOOL_ADMIN_NAV} portalLabel="School Admin" />
    </div>
  )
}
