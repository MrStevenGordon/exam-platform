'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function OwnerIndexPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/owner/school-requests')
  }, [router])

  return null
}
