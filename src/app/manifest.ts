import type { MetadataRoute } from 'next'

// No app manifest existed at all — nothing told a browser this is a real app (vs. just a page),
// so "Add to Home Screen" on Android had no name, no theme color, and no icon to offer beyond a
// screenshot. icon.svg / apple-icon.tsx cover the tab and iOS home-screen icon; this covers
// Android/Chrome's install prompt and the browser's own theme-color chrome.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Smart Assess Ja',
    short_name: 'Smart Assess Ja',
    description: 'Exams, lessons and practice for schools and organizations across Jamaica.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FDF8F3',
    theme_color: '#D4762A',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  }
}
