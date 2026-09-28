// Twitter/X wants its own file (same convention, separate route) even though the image is
// identical to opengraph-image.tsx — re-exporting keeps one actual implementation.
export { default, size, contentType } from './opengraph-image'
