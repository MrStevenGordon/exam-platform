import type { MetadataRoute } from 'next'

const URL = 'https://smartassessja.com'

// Only the pages a search engine should actually index: public marketing/info pages.
// Everything behind a login (every portal, every /api route) is deliberately left out —
// it requires auth to see anything real anyway, and shouldn't be crawled or ranked.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    { url: `${URL}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${URL}/find-my-school`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${URL}/build-my-school`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${URL}/org/signup`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${URL}/download`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${URL}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${URL}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
