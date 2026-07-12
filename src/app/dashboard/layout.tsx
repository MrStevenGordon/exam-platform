'use client'

import Sidebar from '@/components/Sidebar'

const ADMIN_NAV = [
  { label: 'Overview', icon: 'ti-home', href: '/dashboard' },
  { label: 'Change password', icon: 'ti-lock', href: '/change-password' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="portal-layout" style={{ minHeight: "100vh" }}>
      <main className="portal-content">{children}</main>
      <Sidebar navItems={ADMIN_NAV} portalLabel="Admin Portal" />
    </div>
  )
}
