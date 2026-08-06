'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function TestErrorBoundary() {
  return (
    <Suspense fallback={null}>
      <Trigger />
    </Suspense>
  )
}

function Trigger() {
  const searchParams = useSearchParams()
  const shouldThrow = searchParams.get('throw') === '1'

  if (shouldThrow) throw new Error('Verification-only: intentional production test error, safe to ignore')

  return <div>ready</div>
}
