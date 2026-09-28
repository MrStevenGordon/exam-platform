import type { Metadata } from 'next'
import BuildMySchoolClient from './BuildMySchoolClient'

const TITLE = 'Build My School'
const DESCRIPTION = 'Tell us how your school runs exams and what matters most to you. We’ll review your request and set your school up on Smart Assess Ja.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: 'https://smartassessja.com/build-my-school' },
  openGraph: { title: TITLE, description: DESCRIPTION, type: 'website' },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
}

export default function BuildMySchoolPage() {
  return <BuildMySchoolClient />
}
