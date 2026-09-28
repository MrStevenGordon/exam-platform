import type { MetadataRoute } from 'next'

// Every portal and API route requires login and has nothing to show a crawler anyway; disallowing
// them keeps search engines from wasting time on pages that always redirect to /login for them.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/owner/', '/admin-login', '/school-admin/', '/teacher/', '/supervisor/', '/principal/', '/student/', '/dashboard', '/learning/', '/play/', '/org/(portal)/', '/mfa/', '/change-password'],
    },
    sitemap: 'https://smartassessja.com/sitemap.xml',
  }
}
