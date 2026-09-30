import type { Metadata } from 'next'
import ContactClient from './ContactClient'

const TITLE = 'Contact Us'
const DESCRIPTION = 'Tell us about your school or organization and what you’re looking for. We reply within one business day.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: 'https://smartassessja.com/contact' },
  openGraph: { title: TITLE, description: DESCRIPTION, type: 'website' },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
}

export default function ContactPage() {
  return <ContactClient />
}
