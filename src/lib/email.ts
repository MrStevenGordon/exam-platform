// Named senders for different kinds of outbound mail — recipients see who a
// message is actually from (onboarding vs. billing), and replies land in
// the right inbox. Falls back to the Resend sandbox address so local dev
// without a verified domain doesn't need every one of these configured.
const DEFAULT_FROM = process.env.EMAIL_FROM || 'Smart Assess <onboarding@resend.dev>'

export const EMAIL_FROM = {
  onboarding: process.env.EMAIL_FROM_ONBOARDING || DEFAULT_FROM,
  billing: process.env.EMAIL_FROM_BILLING || DEFAULT_FROM,
  sales: process.env.EMAIL_FROM_SALES || DEFAULT_FROM,
  notifications: process.env.EMAIL_FROM_NOTIFICATIONS || DEFAULT_FROM,
}

export async function sendEmail({ to, subject, html, from, replyTo }: { to: string; subject: string; html: string; from?: string; replyTo?: string }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: from || DEFAULT_FROM, to, subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend send failed (${res.status}): ${body}`)
  }
}
