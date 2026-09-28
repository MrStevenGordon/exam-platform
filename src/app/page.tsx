import type { Metadata } from 'next'
import HomeClient from './HomeClient'

const TITLE = 'Smart Assess Ja'
const DESCRIPTION = 'Exams, lessons and practice for schools and organizations across Jamaica — Smart Assess, Smart Learning and Smart Play, all in one platform.'
const URL = 'https://smartassessja.com'
const IMAGE = `${URL}/og/coming-soon.png`

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: URL,
    siteName: TITLE,
    type: 'website',
    locale: 'en_JM',
    images: [{ url: IMAGE, width: 1200, height: 630, alt: TITLE }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [IMAGE],
  },
}

export default function HomePage() {
  return <HomeClient />
}
