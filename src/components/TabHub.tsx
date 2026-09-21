'use client'

import { Suspense, type KeyboardEvent, type ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export type HubTab = { key: string; label: string; render: () => ReactNode }

// One page, several tabs. The active tab lives in the URL (?tab=...), so it
// survives a refresh, can be linked to, and old bookmarks can point straight
// at a tab. Only the active tab is rendered, so each tab loads its own data
// only when it is opened.
export default function TabHub(props: { title: string; tabs: HubTab[]; param?: string }) {
  // useSearchParams needs a Suspense boundary in this Next.js version.
  return (
    <Suspense fallback={null}>
      <TabHubInner {...props} />
    </Suspense>
  )
}

function TabHubInner({ title, tabs, param = 'tab' }: { title: string; tabs: HubTab[]; param?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const active = tabs.find((t) => t.key === searchParams.get(param)) ?? tabs[0]

  function select(key: string) {
    const next = new URLSearchParams(searchParams.toString())
    next.set(param, key)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!delta) return
    e.preventDefault()
    const target = tabs[(index + delta + tabs.length) % tabs.length]
    select(target.key)
    document.getElementById(`hub-tab-${target.key}`)?.focus()
  }

  return (
    <div>
      <p className="portal-page-title">{title}</p>
      <div role="tablist" aria-label={title} className="hub-tabs">
        {tabs.map((tab, i) => (
          <button
            key={tab.key}
            id={`hub-tab-${tab.key}`}
            role="tab"
            type="button"
            aria-selected={tab.key === active.key}
            aria-controls="hub-panel"
            tabIndex={tab.key === active.key ? 0 : -1}
            className="hub-tab"
            onClick={() => select(tab.key)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="hub-panel" aria-labelledby={`hub-tab-${active.key}`} className="hub-embedded">
        {active.render()}
      </div>
    </div>
  )
}
