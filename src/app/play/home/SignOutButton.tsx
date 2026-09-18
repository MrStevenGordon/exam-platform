'use client'

import { useRouter } from 'next/navigation'

export default function SignOutButton() {
  const router = useRouter()
  async function handleSignOut() {
    await fetch('/api/play/logout', { method: 'POST' }).catch(() => {})
    router.push('/play/login')
  }
  return (
    <button onClick={handleSignOut} className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }}>
      Sign out
    </button>
  )
}
