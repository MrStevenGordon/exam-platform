'use client'

import { useEffect, useState } from 'react'
import { getEnabledProducts, PRODUCTS } from '@/lib/products'
import { playTopicHref } from '@/lib/playLink'

// "Practise this topic in Smart Play". A one-way link out of Smart Learning: Learning never
// reads Smart Play's data. It appears only when the lesson has a topic, the school has Smart Play
// switched on, and Smart Play is actually installed; otherwise it shows nothing at all.
export default function PlayTopicLink({ topic }: { topic: { name: string; subject: string } | null }) {
  const [on, setOn] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (topic) getEnabledProducts().then((p) => { if (!cancelled) setOn(p.includes('play')) })
    return () => { cancelled = true }
  }, [topic])

  if (!topic || !on) return null

  return (
    <section className="card" style={{ marginTop: 14, display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }} aria-label="Practise in Smart Play">
      <div style={{ minWidth: 220, flex: 1 }}>
        <p style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 700 }}>Practise this topic as a game</p>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
          Play a round of {topic.name} in {PRODUCTS.play.label}. It has its own sign-in, so you will be asked for your game password.
        </p>
      </div>
      <a href={playTopicHref(topic)} className="btn btn-secondary">
        <i className={`ti ${PRODUCTS.play.icon}`} aria-hidden="true" /> Open {PRODUCTS.play.label}
      </a>
    </section>
  )
}
