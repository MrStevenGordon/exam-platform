'use client'

export default function TestErrorBoundary() {
  throw new Error('Verification-only: intentional production test error, safe to ignore')
}
