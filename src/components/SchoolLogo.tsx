'use client'

import Image from 'next/image'
import { useState } from 'react'

// The school's crest in the menu. Schools upload it once, often straight from a phone, and it used to be downloaded at full size on
// every page (hundreds of KB for a picture shown 32 pixels high). It is now served through Next's image resizer, which sends a small
// WebP of the right size. If the resizer cannot handle the address (for example a logo kept somewhere other than Supabase storage),
// it falls back to showing the original file, so a logo can never disappear because of this.
export default function SchoolLogo({ url }: { url: string }) {
  const [failed, setFailed] = useState(false)
  const style = { height: 32, width: 'auto', maxWidth: '100%', objectFit: 'contain', marginBottom: 10, display: 'block' } as const
  if (failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="School logo" style={{ maxHeight: 32, maxWidth: '100%', objectFit: 'contain', marginBottom: 10, display: 'block' }} />
  }
  return <Image src={url} alt="School logo" width={128} height={32} sizes="128px" style={style} onError={() => setFailed(true)} />
}
