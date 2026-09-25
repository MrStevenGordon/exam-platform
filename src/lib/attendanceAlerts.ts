export type AlertKind = 'teacher_late' | 'teacher_not_started' | 'truancy'

export type AttendanceAlert = {
  id: string
  kind: AlertKind
  class_date: string
  student_id: string | null
  message: string
  created_at: string
  resolved_at: string | null
}

export const ALERT_KIND: Record<AlertKind, { label: string; badge: string }> = {
  teacher_late: { label: 'Teacher late', badge: 'badge-warning' },
  teacher_not_started: { label: 'Not started', badge: 'badge-danger' },
  truancy: { label: 'Truancy', badge: 'badge-danger' },
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// One email covering every alert raised since the last one, grouped by type.
export function buildAlertDigest(alerts: Pick<AttendanceAlert, 'kind' | 'message'>[], schoolName: string) {
  const order: AlertKind[] = ['teacher_not_started', 'teacher_late', 'truancy']
  const groups = order
    .map((kind) => ({ kind, items: alerts.filter((a) => a.kind === kind) }))
    .filter((g) => g.items.length > 0)
  const subject = alerts.length === 1 ? 'Attendance alert: ' + alerts[0].message : `${alerts.length} attendance alerts at ${schoolName}`
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px">
<h2 style="margin:0 0 12px">Attendance alerts</h2>
${groups.map((g) => `<h3 style="margin:16px 0 6px">${ALERT_KIND[g.kind].label} (${g.items.length})</h3><ul style="margin:0;padding-left:18px">${g.items.map((a) => `<li style="margin:4px 0">${escapeHtml(a.message)}</li>`).join('')}</ul>`).join('')}
<p style="margin-top:20px;color:#555;font-size:13px">Open the Leadership Portal to see the live board and mark these as read.</p>
</div>`
  return { subject, html }
}
