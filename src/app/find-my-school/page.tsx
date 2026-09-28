import type { Metadata } from 'next'
import FindMySchoolClient from './FindMySchoolClient'

const TITLE = 'Find My School'
const DESCRIPTION = "Search for your school and go straight to its own Smart Assess Ja sign-in page."

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: 'https://smartassessja.com/find-my-school' },
  openGraph: { title: TITLE, description: DESCRIPTION, type: 'website' },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
}

export default function FindMySchoolPage() {
  return <FindMySchoolClient />
}
