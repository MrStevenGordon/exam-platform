'use client'

import { useRouter } from 'next/navigation'

export default function SignOutButton() {
  const router = useRouter()
  async function handleSignOut() {
    await fetch('/api/play/logout', { method: 'POST' }).catch(() => {})
    // Smart Play has no sign-in of its own; the exam sign-in page is where they go next.
    router.push('/login')
  }
  return (
    <button onClick={handleSignOut} className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }}>
      Sign out
    </button>
  )
}
