import type { Metadata } from 'next'
import HomeClient from './HomeClient'

const TITLE = 'Smart Assess Ja'
const DESCRIPTION = 'Exams, lessons and practice for schools and organizations across Jamaica — Smart Assess, Smart Learning and Smart Play, all in one platform.'
const URL = 'https://smartassessja.com'

// og:image/twitter:image come from opengraph-image.tsx / twitter-image.tsx (generated, not a
// static file) — Next.js auto-injects those tags for this route, so they're deliberately not
// repeated here; setting both would risk two conflicting og:image tags on the same page.
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
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
}

export default function HomePage() {
  return <HomeClient />
}
