import type { Metadata } from 'next'
import OrgSignupClient from './OrgSignupClient'

const TITLE = 'Request an Organization Account'
const DESCRIPTION = 'Publish a one-off exam or assessment with Smart Assess Ja — no school roster setup required.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: 'https://smartassessja.com/org/signup' },
  openGraph: { title: TITLE, description: DESCRIPTION, type: 'website' },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
}

export default function OrgSignupPage() {
  return <OrgSignupClient />
}
