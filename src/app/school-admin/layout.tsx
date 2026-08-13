'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import PageTransition from '@/components/PageTransition'
import InactivityLogout from '@/components/InactivityLogout'
import { getMfaRedirect } from '@/lib/mfaCheck'
import { verifyPortalRole } from '@/lib/verifyPortalRole'

const SCHOOL_ADMIN_NAV = [
  { label: 'Overview', icon: 'ti-home', href: '/school-admin' },
  { label: 'Departments', icon: 'ti-building', href: '/school-admin/departments' },
  { label: 'Subjects', icon: 'ti-book', href: '/school-admin/subjects' },
  { label: 'Timetable', icon: 'ti-calendar', href: '/school-admin/timetable' },
  { label: 'Active Sessions', icon: 'ti-device-desktop', href: '/school-admin/active-sessions' },
  { label: 'Staff', icon: 'ti-users', href: '/school-admin/staff' },
  { label: 'Students', icon: 'ti-school', href: '/school-admin/students' },
  { label: 'Password requests', icon: 'ti-key', href: '/school-admin/password-requests' },
  { label: 'Analytics', icon: 'ti-chart-bar', href: '/school-admin/analytics' },
  { label: 'Activity', icon: 'ti-activity', href: '/school-admin/activity' },
  { label: 'Year Promotion', icon: 'ti-arrow-up-circle', href: '/dashboard' },
  { label: 'Messages', icon: 'ti-message-circle', href: '/school-admin/messages' },
  { label: 'Settings', icon: 'ti-settings', href: '/school-admin/settings' },
  { label: 'My Profile', icon: 'ti-user', href: '/school-admin/profile' },
]

export default function SchoolAdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    async function checkAccess() {
      const roleRedirect = await verifyPortalRole('admin')
      if (roleRedirect) { router.push(roleRedirect); return }
      const mfaRedirect = await getMfaRedirect('admin')
      if (mfaRedirect) { router.push(`${mfaRedirect}?from=${encodeURIComponent(pathname)}`); return }
      setChecked(true)
    }
    checkAccess()
  }, [router, pathname])

  if (!checked) return null

  return (
    <div className="portal-layout" style={{ minHeight: "100vh" }}>
      <InactivityLogout />
      <main className="portal-content"><PageTransition>{children}</PageTransition></main>
      <Sidebar navItems={SCHOOL_ADMIN_NAV} portalLabel="School Admin" />
    </div>
  )
}
