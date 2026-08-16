'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// Never renders on an exam-taking route — a chat window available during
// a locked-down proctored exam would be a real integrity hole, not just
// a UX distraction. Also skipped on pages that aren't a real destination
// (coming-soon/maintenance gates), matching NavBar's own hide list.
const EXAM_ROUTE_PATTERNS = [
  /^\/student\/exam\/[^/]+\/take/,
  /^\/student\/direct-exam\/[^/]+\/take/,
  /^\/take-exam\/[^/]+\/questions/,
  /^\/demo-exam/,
]
const HIDDEN_ROUTES = ['/coming-soon', '/maintenance']

type Message = { role: 'user' | 'assistant'; content: string }

export default function ChatWidget() {
  const pathname = usePathname() || ''
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [conversationId, setConversationId] = useState<string | undefined>(undefined)
  const [role, setRole] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const isExamRoute = EXAM_ROUTE_PATTERNS.some((p) => p.test(pathname))
  const isHiddenRoute = HIDDEN_ROUTES.includes(pathname)

  useEffect(() => {
    async function loadRole() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setRole(null); return }
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setRole(data?.role || null)
    }
    loadRole()
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  if (isExamRoute || isHiddenRoute) return null

  async function handleSend() {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setSending(true)

    const { data: { session } } = await supabase.auth.getSession()

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversationId,
          accessToken: session?.access_token,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.error || 'Something went wrong. Please try again.' }])
      } else {
        setConversationId(data.conversationId)
        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: "Couldn't reach the server. Please try again." }])
    }
    setSending(false)
  }

  const greeting = role
    ? `Hi! Ask me how anything in the ${role === 'admin' ? 'school admin' : role} portal works.`
    : "Hi! Ask me anything about Smart Assess Ja."

  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 800, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {open && (
        <div
          style={{
            width: 340, height: 440, marginBottom: 12, display: 'flex', flexDirection: 'column',
            background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12,
            boxShadow: '0 8px 28px rgba(0,0,0,0.18)', overflow: 'hidden',
          }}
        >
          <div style={{ padding: '12px 16px', background: 'var(--accent)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.85 }}>Smart Assess Ja</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Help</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              style={{ background: 'none', border: 'none', color: 'white', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 4 }}
            >
              ×
            </button>
          </div>

          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'var(--page-bg)', padding: '8px 12px', borderRadius: 10, alignSelf: 'flex-start', maxWidth: '85%' }}>
              {greeting}
            </div>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  fontSize: 13, padding: '8px 12px', borderRadius: 10, maxWidth: '85%', lineHeight: 1.5,
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  background: m.role === 'user' ? 'var(--accent-light)' : 'var(--page-bg)',
                  color: 'var(--text-primary)',
                }}
              >
                {m.content}
              </div>
            ))}
            {sending && (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'var(--page-bg)', padding: '8px 12px', borderRadius: 10, alignSelf: 'flex-start' }}>
                …
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid var(--border)' }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
              placeholder="Type a question…"
              maxLength={2000}
              style={{ flex: 1, fontSize: 13, padding: '8px 10px' }}
            />
            <button
              onClick={handleSend}
              disabled={sending || !input.trim()}
              className="btn btn-primary"
              style={{ fontSize: 13, padding: '8px 14px' }}
            >
              Send
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close help chat' : 'Open help chat'}
        style={{
          width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'var(--accent)', color: 'white', fontSize: 22, fontWeight: 700,
          boxShadow: '0 4px 14px rgba(0,0,0,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {open ? '×' : '?'}
      </button>
    </div>
  )
}
