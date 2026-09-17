'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

type StaffMember = { id: string; full_name: string; role: string }
type Conversation = { id: string; type: 'direct' | 'staff_group'; created_at: string }
type Participant = { conversation_id: string; user_id: string }
type Message = { id: string; conversation_id: string; sender_id: string; body: string; created_at: string }

export default function StaffMessages() {
  const [myId, setMyId] = useState('')
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [readState, setReadState] = useState<Record<string, string>>({})
  const [messages, setMessages] = useState<Message[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [draft, setDraft] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const scrollRef = useRef<HTMLDivElement>(null)
  const selectedIdRef = useRef('')
  useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])

  const staffById = useCallback((id: string) => staff.find((s) => s.id === id), [staff])

  async function loadAll() {
    try {
      await loadAllInner()
    } catch (err) {
      console.error('Failed to load staff messages', err)
      setLoading(false)
    }
  }

  async function loadAllInner() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setMyId(user.id)

    const { data: staffGroupId } = await supabase.rpc('get_or_create_staff_group')

    const [{ data: staffData }, { data: convoData }, { data: participantData }, { data: myParticipantData }, { data: messageData }] = await Promise.all([
      supabase.rpc('list_staff_directory'),
      supabase.from('conversations').select('id, type, created_at'),
      supabase.from('conversation_participants').select('conversation_id, user_id'),
      supabase.from('conversation_participants').select('conversation_id, last_read_at').eq('user_id', user.id),
      supabase.from('messages').select('id, conversation_id, sender_id, body, created_at').order('created_at', { ascending: true }),
    ])

    setStaff(staffData || [])
    setConversations(convoData || [])
    setParticipants(participantData || [])
    setMessages(messageData || [])

    const readMap: Record<string, string> = {}
    ;(myParticipantData || []).forEach((r) => { readMap[r.conversation_id] = r.last_read_at })
    setReadState(readMap)

    if (!selectedIdRef.current && staffGroupId) setSelectedId(staffGroupId)
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  useEffect(() => {
    const channel = supabase
      .channel('staff-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as Message
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
        if (msg.conversation_id === selectedIdRef.current) {
          supabase.rpc('mark_conversation_read', { conv_id: msg.conversation_id }).then(() => {
            setReadState((prev) => ({ ...prev, [msg.conversation_id]: new Date().toISOString() }))
            window.dispatchEvent(new Event('unread-messages-changed'))
          })
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    if (!selectedId) return
    supabase.rpc('mark_conversation_read', { conv_id: selectedId }).then(() => {
      setReadState((prev) => ({ ...prev, [selectedId]: new Date().toISOString() }))
      window.dispatchEvent(new Event('unread-messages-changed'))
    })
  }, [selectedId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, selectedId])

  function conversationName(c: Conversation): string {
    if (c.type === 'staff_group') return 'Staff'
    const otherId = participants.find((p) => p.conversation_id === c.id && p.user_id !== myId)?.user_id
    return (otherId && staffById(otherId)?.full_name) || 'Unknown'
  }

  function lastMessageFor(conversationId: string): Message | undefined {
    const msgs = messages.filter((m) => m.conversation_id === conversationId)
    return msgs[msgs.length - 1]
  }

  function unreadCountFor(conversationId: string): number {
    const readAt = readState[conversationId]
    if (!readAt) return messages.filter((m) => m.conversation_id === conversationId && m.sender_id !== myId).length
    return messages.filter((m) => m.conversation_id === conversationId && m.sender_id !== myId && m.created_at > readAt).length
  }

  const sortedConversations = [...conversations].sort((a, b) => {
    if (a.type === 'staff_group') return -1
    if (b.type === 'staff_group') return 1
    const aLast = lastMessageFor(a.id)?.created_at || a.created_at
    const bLast = lastMessageFor(b.id)?.created_at || b.created_at
    return bLast.localeCompare(aLast)
  })

  const threadMessages = messages.filter((m) => m.conversation_id === selectedId)
  const selectedConversation = conversations.find((c) => c.id === selectedId)

  async function handleStartConversation(otherId: string) {
    setShowPicker(false)
    const { data, error: rpcError } = await supabase.rpc('start_direct_conversation', { other_user_id: otherId })
    if (rpcError) { setError(rpcError.message); return }
    await loadAll()
    if (data) setSelectedId(data)
  }

  async function handleSend() {
    if (!draft.trim() || !selectedId) return
    setSending(true)
    setError('')
    const { error: insertError } = await supabase.from('messages').insert({
      conversation_id: selectedId,
      sender_id: myId,
      body: draft.trim(),
    })
    if (insertError) {
      setError(insertError.message)
    } else {
      setDraft('')
    }
    setSending(false)
  }

  if (loading) return <div className="page-container">Loading…</div>

  return (
    <div className="page-container" style={{ maxWidth: 960 }}>
      <h1 style={{ marginBottom: 16 }}>Messages</h1>
      {error && <div className="banner banner-danger" style={{ marginBottom: 12 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 16, height: 560, border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ width: 240, flex: 'none', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--page-bg)' }}>
          <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
            <button onClick={() => setShowPicker(true)} className="btn btn-secondary" style={{ width: '100%', fontSize: 13 }}>
              + New message
            </button>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {sortedConversations.map((c) => {
              const unread = unreadCountFor(c.id)
              const last = lastMessageFor(c.id)
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', cursor: 'pointer',
                    background: c.id === selectedId ? 'var(--accent-light)' : 'transparent',
                    borderLeft: c.id === selectedId ? '3px solid var(--accent)' : '3px solid transparent',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{conversationName(c)}</span>
                    {unread > 0 && (
                      <span style={{ background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 100, padding: '1px 7px' }}>{unread}</span>
                    )}
                  </div>
                  {last && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {last.sender_id === myId ? 'You: ' : ''}{last.body}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {selectedConversation ? (
            <>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>
                {conversationName(selectedConversation)}
              </div>
              <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {threadMessages.map((m) => {
                  const mine = m.sender_id === myId
                  return (
                    <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                      {!mine && selectedConversation.type === 'staff_group' && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{staffById(m.sender_id)?.full_name || 'Unknown'}</span>
                      )}
                      <span style={{
                        maxWidth: '75%', padding: '8px 12px', borderRadius: 12, fontSize: 14,
                        background: mine ? 'var(--accent)' : 'var(--page-bg)',
                        color: mine ? '#fff' : 'var(--text-primary)',
                        border: mine ? 'none' : '1px solid var(--border)',
                      }}>
                        {m.body}
                      </span>
                    </div>
                  )
                })}
                {threadMessages.length === 0 && (
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No messages yet. Say hello.</p>
                )}
              </div>
              <div style={{ padding: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                  placeholder="Write a message…"
                  style={{ flex: 1 }}
                />
                <button onClick={handleSend} disabled={sending || !draft.trim()} className="btn btn-primary">Send</button>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              Select a conversation
            </div>
          )}
        </div>
      </div>

      {showPicker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setShowPicker(false)}>
          <div className="card" style={{ width: 340, maxHeight: 420, overflowY: 'auto', background: 'var(--card-bg)' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 10 }}>Start a conversation</h3>
            {staff.filter((s) => s.id !== myId).map((s) => (
              <button
                key={s.id}
                onClick={() => handleStartConversation(s.id)}
                className="btn btn-secondary"
                style={{ width: '100%', textAlign: 'left', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}
              >
                <span>{s.full_name}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{s.role}</span>
              </button>
            ))}
            {staff.filter((s) => s.id !== myId).length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No other staff yet.</p>}
          </div>
        </div>
      )}
    </div>
  )
}
