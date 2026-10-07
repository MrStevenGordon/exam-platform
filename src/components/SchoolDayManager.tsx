'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { loadBlocks, loadPeriods, loadSections } from '@/lib/schoolDay'
import {
  DAY_NAMES, daysLabel, findClashes, generatePeriods, gradesLabel, range12, toMinutes,
  type BlockRow, type PeriodRow, type SectionLike,
} from '@/lib/schoolDayPure'
import { gradeFromText } from '@/lib/topics'
import { jamaicaDate, schoolYear, shiftDate, isoWeekday } from '@/lib/attendance'

// The school day: bell times, lunch by grade, and school events. For the school admin, vice principals and the principal.
// Everyone's timetable follows this. Heads of department and the school admin then place each teacher's classes.

type Section = SectionLike & { subject: string; teacher: { full_name: string } | null; class_group: { name: string; year_grade?: string | null } | null }
type Draft = {
  id?: string; kind: 'lunch' | 'event'; title: string; repeat: 'weekly' | 'once'; days: number[]; dateFrom: string; dateTo: string
  allDay: boolean; start: string; end: string; everyGrade: boolean; grades: number[]; note: string
}
const GRADES = [7, 8, 9, 10, 11, 12, 13]
const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block' }
const longDate = (d: string) => new Intl.DateTimeFormat('en-JM', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${d}T12:00:00Z`))

const blankDraft = (kind: 'lunch' | 'event'): Draft => ({ kind, title: kind === 'lunch' ? 'Lunch' : '', repeat: 'weekly', days: kind === 'lunch' ? [1, 2, 3, 4, 5] : [], dateFrom: '', dateTo: '', allDay: false, start: '', end: '', everyGrade: kind === 'event', grades: [], note: '' })
const fromBlock = (b: BlockRow): Draft => ({
  id: b.id, kind: b.kind, title: b.title, repeat: b.days ? 'weekly' : 'once', days: b.days || [], dateFrom: b.date_from || '', dateTo: b.date_to || '',
  allDay: !b.start_time, start: (b.start_time || '').slice(0, 5), end: (b.end_time || '').slice(0, 5), everyGrade: !b.grades, grades: b.grades || [], note: b.note || '',
})

function whenText(b: BlockRow): string {
  const t = b.start_time && b.end_time ? range12(toMinutes(b.start_time)!, toMinutes(b.end_time)!) : 'All day'
  if (b.days) return `${daysLabel(b.days)}, ${t}`
  return `${b.date_from === b.date_to ? longDate(b.date_from!) : `${longDate(b.date_from!)} to ${longDate(b.date_to!)}`}, ${t}`
}

export default function SchoolDayManager() {
  const today = jamaicaDate()
  const year = schoolYear(today)
  const [loading, setLoading] = useState(true)
  const [periods, setPeriods] = useState<PeriodRow[]>([])
  const [blocks, setBlocks] = useState<BlockRow[]>([])
  const [available, setAvailable] = useState(true)
  const [sections, setSections] = useState<Section[]>([])
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [saving, setSaving] = useState(false)

  const [genStart, setGenStart] = useState('08:00')
  const [genEnd, setGenEnd] = useState('15:00')
  const [genLen, setGenLen] = useState(60)
  const [showGen, setShowGen] = useState(false)
  const [newPeriod, setNewPeriod] = useState({ name: '', start: '', end: '' })
  const [edits, setEdits] = useState<Record<string, { name: string; start: string; end: string }>>({})
  const [draft, setDraft] = useState<Draft | null>(null)

  const [tick, setTick] = useState(0)
  const reload = () => setTick((t) => t + 1)
  useEffect(() => {
    let cancelled = false
    async function run() {
      const [p, b, s] = await Promise.all([
        loadPeriods(year), loadBlocks(year),
        loadSections<Section>('id, subject, day_of_week, period_id, class_group_id, teacher:profiles!teacher_id(full_name), class_group:class_groups(name, year_grade)', year),
      ])
      if (cancelled) return
      setPeriods(p); setBlocks(b.blocks); setAvailable(b.available); setSections(s)
      setEdits(Object.fromEntries(p.map((x) => [x.id, { name: x.name, start: x.start_time.slice(0, 5), end: x.end_time.slice(0, 5) }])))
      setLoading(false)
    }
    run()
    return () => { cancelled = true }
  }, [year, tick])

  const say = (m: string) => { setDone(m); setTimeout(() => setDone(''), 3500) }
  const fail = (m: string) => { setError(m); setSaving(false) }

  const preview = useMemo(() => generatePeriods(toMinutes(genStart) ?? 0, toMinutes(genEnd) ?? 0, genLen), [genStart, genEnd, genLen])

  async function createPeriods(list: { name: string; start_time: string; end_time: string; order_index: number }[]) {
    setSaving(true); setError('')
    const { error: e } = await supabase.from('timetable_periods').insert(list.map((p) => ({ ...p, academic_year: year })))
    if (e) return fail(e.message)
    setSaving(false); setShowGen(false); say(`${list.length} period${list.length === 1 ? '' : 's'} created.`); reload()
  }
  async function startAgain() {
    if (sections.length > 0) return
    if (!confirm('Remove every period and make new ones? No classes have been placed yet, so nothing else changes.')) return
    setSaving(true)
    const { error: e } = await supabase.from('timetable_periods').delete().eq('academic_year', year)
    if (e) return fail(e.message)
    setSaving(false); setShowGen(true); reload()
  }
  async function savePeriod(id: string) {
    const v = edits[id]; if (!v) return
    setSaving(true); setError('')
    const { error: e } = await supabase.from('timetable_periods').update({ name: v.name.trim(), start_time: v.start, end_time: v.end }).eq('id', id)
    if (e) return fail(e.message)
    setSaving(false); say('Period saved.'); reload()
  }
  async function deletePeriod(id: string) {
    const using = sections.filter((s) => s.period_id === id).length
    if (!confirm(using ? `${using} class${using === 1 ? ' is' : 'es are'} placed in this period. Deleting it removes them from the timetable. Continue?` : 'Delete this period?')) return
    const { error: e } = await supabase.from('timetable_periods').delete().eq('id', id)
    if (e) return fail(e.message)
    reload()
  }
  async function addOnePeriod() {
    if (!newPeriod.name.trim() || !newPeriod.start || !newPeriod.end) return
    await createPeriods([{ name: newPeriod.name.trim(), start_time: newPeriod.start, end_time: newPeriod.end, order_index: periods.length }])
    setNewPeriod({ name: '', start: '', end: '' })
  }

  function draftProblem(d: Draft): string {
    if (!d.title.trim()) return 'Give it a name.'
    if (d.repeat === 'weekly' && d.days.length === 0) return 'Choose at least one day.'
    if (d.repeat === 'once' && (!d.dateFrom || !d.dateTo)) return 'Choose the date.'
    if (d.repeat === 'once' && d.dateTo < d.dateFrom) return 'The last day cannot be before the first day.'
    if (!d.allDay) {
      if (!d.start || !d.end) return 'Give a start and an end time, or choose all day.'
      if (d.end <= d.start) return 'The end time must be after the start time.'
    }
    if (d.kind === 'lunch' && (d.allDay || d.everyGrade || d.grades.length === 0)) return d.allDay ? 'Lunch needs times.' : 'Choose which grades this lunch is for.'
    if (!d.everyGrade && d.grades.length === 0) return 'Choose the grades, or every grade.'
    return ''
  }
  async function saveDraft() {
    if (!draft) return
    const problem = draftProblem(draft)
    if (problem) { setError(problem); return }
    setSaving(true); setError('')
    const row = {
      kind: draft.kind, title: draft.title.trim(), academic_year: year, note: draft.note.trim() || null,
      grades: draft.everyGrade ? null : [...draft.grades].sort((a, b) => a - b),
      days: draft.repeat === 'weekly' ? [...draft.days].sort((a, b) => a - b) : null,
      date_from: draft.repeat === 'once' ? draft.dateFrom : null, date_to: draft.repeat === 'once' ? draft.dateTo : null,
      start_time: draft.allDay ? null : draft.start, end_time: draft.allDay ? null : draft.end,
    }
    const { error: e } = draft.id ? await supabase.from('school_day_blocks').update(row).eq('id', draft.id) : await supabase.from('school_day_blocks').insert(row)
    if (e) return fail(e.message)
    setSaving(false); setDraft(null); say(draft.kind === 'lunch' ? 'Lunch saved.' : 'Event saved.'); reload()
  }
  async function removeBlock(b: BlockRow) {
    if (!confirm(`Remove "${b.title}"?`)) return
    const { error: e } = await supabase.from('school_day_blocks').delete().eq('id', b.id)
    if (e) return fail(e.message)
    say('Removed.'); reload()
  }

  // Classes that run into lunch or an event: every week, and one-off events in the next two months.
  const clashes = useMemo(() => {
    const gradeOf = (s: SectionLike) => gradeFromText((s as Section).class_group?.year_grade)
    const weekly = findClashes(sections, periods, blocks.filter((b) => b.days), gradeOf)
    const once: { date: string; c: ReturnType<typeof findClashes>[number] }[] = []
    for (let i = 0; i < 60; i++) {
      const date = shiftDate(today, i), dow = isoWeekday(date)
      if (dow < 1 || dow > 5) continue
      for (const c of findClashes(sections.filter((s) => s.day_of_week === dow), periods, blocks.filter((b) => !b.days), gradeOf, { [dow]: date })) once.push({ date, c })
    }
    return { weekly, once }
  }, [sections, periods, blocks, today])
  const sectionName = (id: string) => { const s = sections.find((x) => x.id === id); return s ? `${s.subject}${s.class_group ? `, ${s.class_group.name}` : ''}${s.teacher ? ` (${s.teacher.full_name})` : ''}` : 'A class' }

  if (loading) return <div className="page-container">Loading…</div>

  const lunches = blocks.filter((b) => b.kind === 'lunch')
  const events = blocks.filter((b) => b.kind === 'event')
  const input: React.CSSProperties = { width: '100%', marginTop: 4 }
  const dayChips = (sel: number[], on: (d: number[]) => void) => (
    <div role="group" aria-label="Days" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
      {[1, 2, 3, 4, 5].map((d) => (
        <button key={d} type="button" aria-pressed={sel.includes(d)} className={sel.includes(d) ? 'btn btn-primary' : 'btn btn-ghost'} style={{ padding: '4px 12px', fontSize: 13 }}
          onClick={() => on(sel.includes(d) ? sel.filter((x) => x !== d) : [...sel, d])}>{DAY_NAMES[d].slice(0, 3)}</button>
      ))}
    </div>
  )
  const form = draft && (
    <div className="card" style={{ marginTop: 14, background: 'var(--page-bg)' }} role="group" aria-label={draft.kind === 'lunch' ? 'Lunch' : 'Event'}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <div><label htmlFor="sd-title" style={label}>Name</label><input id="sd-title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} style={input} placeholder={draft.kind === 'lunch' ? 'Lunch' : 'For example: General devotion'} /></div>
        {draft.kind === 'event' && (
          <div><label htmlFor="sd-repeat" style={label}>How often</label>
            <select id="sd-repeat" value={draft.repeat} onChange={(e) => setDraft({ ...draft, repeat: e.target.value as 'weekly' | 'once' })} style={input}>
              <option value="weekly">Every week on chosen days</option><option value="once">One date (or a run of dates)</option>
            </select></div>
        )}
        {draft.repeat === 'weekly'
          ? <div><span style={label}>Days</span>{dayChips(draft.days, (days) => setDraft({ ...draft, days }))}</div>
          : <>
              <div><label htmlFor="sd-from" style={label}>First day</label><input id="sd-from" type="date" value={draft.dateFrom} onChange={(e) => setDraft({ ...draft, dateFrom: e.target.value, dateTo: draft.dateTo || e.target.value })} style={input} /></div>
              <div><label htmlFor="sd-to" style={label}>Last day</label><input id="sd-to" type="date" value={draft.dateTo} onChange={(e) => setDraft({ ...draft, dateTo: e.target.value })} style={input} /></div>
            </>}
        {draft.kind === 'event' && (
          <div style={{ display: 'flex', alignItems: 'end' }}><label style={{ fontSize: 14 }}><input type="checkbox" checked={draft.allDay} onChange={(e) => setDraft({ ...draft, allDay: e.target.checked })} /> The whole school day</label></div>
        )}
        {!draft.allDay && <>
          <div><label htmlFor="sd-start" style={label}>From</label><input id="sd-start" type="time" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} style={input} /></div>
          <div><label htmlFor="sd-end" style={label}>To</label><input id="sd-end" type="time" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} style={input} /></div>
        </>}
      </div>
      <div style={{ marginTop: 12 }}>
        <span style={label}>Grades</span>
        {draft.kind === 'event' && <label style={{ fontSize: 14, display: 'inline-block', marginTop: 4, marginRight: 14 }}><input type="checkbox" checked={draft.everyGrade} onChange={(e) => setDraft({ ...draft, everyGrade: e.target.checked })} /> Every grade</label>}
        {!draft.everyGrade && GRADES.map((g) => (
          <label key={g} style={{ fontSize: 14, display: 'inline-block', marginTop: 4, marginRight: 12 }}>
            <input type="checkbox" checked={draft.grades.includes(g)} onChange={(e) => setDraft({ ...draft, grades: e.target.checked ? [...draft.grades, g] : draft.grades.filter((x) => x !== g) })} /> {g}
          </label>
        ))}
      </div>
      <div style={{ marginTop: 12 }}><label htmlFor="sd-note" style={label}>Note (optional)</label><input id="sd-note" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} style={input} maxLength={500} /></div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button type="button" className="btn btn-primary" onClick={saveDraft} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        <button type="button" className="btn btn-ghost" onClick={() => { setDraft(null); setError('') }}>Cancel</button>
      </div>
    </div>
  )

  return (
    <div className="page-container" style={{ maxWidth: 900 }}>
      <p className="portal-page-title" style={{ margin: 0 }}>School day</p>
      <p className="portal-page-sub" style={{ margin: '4px 0 6px' }}>{year}</p>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 18px' }}>
        Set the bell times, lunch and school events once. Every timetable follows them. Heads of department and the school admin then place each teacher&apos;s classes.
      </p>
      {done && <div role="status" className="banner banner-success" style={{ marginBottom: 14 }}>{done}</div>}
      {error && <div role="alert" className="banner banner-danger" style={{ marginBottom: 14 }}>{error}</div>}

      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Bell times</h2>
          {periods.length > 0 && sections.length === 0 && <button type="button" className="btn btn-ghost" onClick={startAgain}>Start again</button>}
        </div>
        {periods.length === 0 || showGen ? (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 10px' }}>Give the start and end of the school day and how long each period is. You can change any period afterwards.</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
              <div><label htmlFor="g-s" style={label}>Day starts</label><input id="g-s" type="time" value={genStart} onChange={(e) => setGenStart(e.target.value)} style={{ marginTop: 4 }} /></div>
              <div><label htmlFor="g-e" style={label}>Day ends</label><input id="g-e" type="time" value={genEnd} onChange={(e) => setGenEnd(e.target.value)} style={{ marginTop: 4 }} /></div>
              <div><label htmlFor="g-l" style={label}>Period length (minutes)</label><input id="g-l" type="number" min={10} max={180} value={genLen} onChange={(e) => setGenLen(Number(e.target.value))} style={{ marginTop: 4, width: 110 }} /></div>
            </div>
            {preview.length > 0
              ? <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '12px 0' }}>{preview.map((p) => <span key={p.order_index} className="badge badge-default">{p.name}: {range12(toMinutes(p.start_time)!, toMinutes(p.end_time)!)}</span>)}</div>
              : <p style={{ fontSize: 13, color: 'var(--danger)', margin: '12px 0' }}>These times do not make any period. Check the start, end and length.</p>}
            <button type="button" className="btn btn-primary" disabled={saving || preview.length === 0} onClick={() => createPeriods(preview)}>Create these periods</button>
            {showGen && <button type="button" className="btn btn-ghost" style={{ marginLeft: 8 }} onClick={() => setShowGen(false)}>Cancel</button>}
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead><tr>{['Name', 'Start', 'End', ''].map((h, i) => <th key={i} style={{ textAlign: 'left', fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', padding: '4px 6px' }}>{h}</th>)}</tr></thead>
              <tbody>
                {periods.map((p) => {
                  const v = edits[p.id] || { name: p.name, start: '', end: '' }
                  const changed = v.name !== p.name || v.start !== p.start_time.slice(0, 5) || v.end !== p.end_time.slice(0, 5)
                  return (
                    <tr key={p.id}>
                      <td style={{ padding: 4 }}><input aria-label={`${p.name} name`} value={v.name} onChange={(e) => setEdits({ ...edits, [p.id]: { ...v, name: e.target.value } })} style={{ width: '100%' }} /></td>
                      <td style={{ padding: 4 }}><input aria-label={`${p.name} start`} type="time" value={v.start} onChange={(e) => setEdits({ ...edits, [p.id]: { ...v, start: e.target.value } })} /></td>
                      <td style={{ padding: 4 }}><input aria-label={`${p.name} end`} type="time" value={v.end} onChange={(e) => setEdits({ ...edits, [p.id]: { ...v, end: e.target.value } })} /></td>
                      <td style={{ padding: 4, whiteSpace: 'nowrap' }}>
                        <button type="button" className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: 13 }} disabled={!changed || saving} onClick={() => savePeriod(p.id)}>Save</button>
                        <button type="button" className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 13, color: 'var(--danger)' }} onClick={() => deletePeriod(p.id)} aria-label={`Delete ${p.name}`}>Delete</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end', marginTop: 12 }}>
              <div><label htmlFor="np-n" style={label}>Add a period</label><input id="np-n" value={newPeriod.name} onChange={(e) => setNewPeriod({ ...newPeriod, name: e.target.value })} placeholder="Name" style={{ marginTop: 4 }} /></div>
              <input aria-label="New period start" type="time" value={newPeriod.start} onChange={(e) => setNewPeriod({ ...newPeriod, start: e.target.value })} />
              <input aria-label="New period end" type="time" value={newPeriod.end} onChange={(e) => setNewPeriod({ ...newPeriod, end: e.target.value })} />
              <button type="button" className="btn btn-secondary" onClick={addOnePeriod} disabled={saving}>Add</button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '10px 0 0' }}>A class can last more than one period (a double period). The head of department chooses that when placing the class.</p>
          </div>
        )}
      </div>

      {!available ? (
        <p className="banner banner-warning">Lunch and school events need a database update that has not been applied to this school yet.</p>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 16 }}>Lunch by grade</h2>
              <button type="button" className="btn btn-secondary" onClick={() => { setError(''); setDraft(blankDraft('lunch')) }}>+ Add a lunch group</button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '6px 0 0' }}>Each group of grades has its own lunch window.</p>
            {lunches.length === 0 ? <p style={{ fontSize: 13, margin: '12px 0 0' }}>No lunch times yet.</p> : (
              <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }}>
                {lunches.map((b) => (
                  <li key={b.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderTop: '1px solid var(--border)', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span><strong>{gradesLabel(b.grades)}</strong> · {whenText(b)}</span>
                    <span><button type="button" className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => { setError(''); setDraft(fromBlock(b)) }}>Edit</button><button type="button" className="btn btn-ghost" style={{ fontSize: 13, color: 'var(--danger)' }} onClick={() => removeBlock(b)}>Remove</button></span>
                  </li>
                ))}
              </ul>
            )}
            {draft?.kind === 'lunch' && form}
          </div>

          <div className="card" style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 16 }}>School events and activities</h2>
              <button type="button" className="btn btn-primary" onClick={() => { setError(''); setDraft(blankDraft('event')) }}>+ Add an event</button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '6px 0 0' }}>Anything that takes time out of lessons, such as devotion, clubs and societies, or a sports day. Every timetable shows it in its place.</p>
            {events.length === 0 ? <p style={{ fontSize: 13, margin: '12px 0 0' }}>No events yet.</p> : (
              <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }}>
                {events.map((b) => (
                  <li key={b.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderTop: '1px solid var(--border)', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span><strong>{b.title}</strong> · {whenText(b)} · {gradesLabel(b.grades)}{b.note ? <span style={{ color: 'var(--text-secondary)' }}> · {b.note}</span> : null}</span>
                    <span><button type="button" className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => { setError(''); setDraft(fromBlock(b)) }}>Edit</button><button type="button" className="btn btn-ghost" style={{ fontSize: 13, color: 'var(--danger)' }} onClick={() => removeBlock(b)}>Remove</button></span>
                  </li>
                ))}
              </ul>
            )}
            {draft?.kind === 'event' && form}
          </div>

          <div className="card">
            <h2 style={{ margin: 0, fontSize: 16 }}>Classes that clash</h2>
            {clashes.weekly.length === 0 && clashes.once.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '8px 0 0' }}>No class runs into lunch or an event. If you add an event later, any class it affects is listed here.</p>
            ) : (
              <>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '6px 0 8px' }}>These classes are still on the timetable, but the event or lunch takes their place on screen. Ask the head of department to move them.</p>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
                  {clashes.weekly.map((c) => <li key={c.sectionId + c.blockId}>{sectionName(c.sectionId)}: {DAY_NAMES[c.dow]}s, {c.when}, clashes with <strong>{c.title}</strong></li>)}
                  {clashes.once.slice(0, 20).map(({ date, c }) => <li key={c.sectionId + c.blockId + date}>{sectionName(c.sectionId)}: {longDate(date)}, {c.when}, clashes with <strong>{c.title}</strong></li>)}
                </ul>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
