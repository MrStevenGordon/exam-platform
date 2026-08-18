import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/verifySystemAdmin'
import { rateLimit, getClientIp } from '@/lib/rateLimit'
import { validateBody } from '@/lib/validateBody'

const DEFAULT_EVENT_KEY = 'ocbn-2026'
const LEADERBOARD_LIMIT = 10

// Letters (incl. accented), spaces, hyphens, apostrophes -- a first name
// typed on a phone at a live event, nothing else.
const NAME_PATTERN = /^[\p{L}\p{M}\s'-]{1,24}$/u

const submitSchema = z.object({
  eventKey: z.string().trim().min(1).max(60).default(DEFAULT_EVENT_KEY),
  firstName: z.string().trim().min(1).max(24).regex(NAME_PATTERN, 'Use letters only.'),
  score: z.number().int().min(0).max(200),
  totalQuestions: z.number().int().min(1).max(200),
  timeSeconds: z.number().int().min(0).max(3600),
  honeypot: z.string().max(500).optional(),
}).strict().refine((v) => v.score <= v.totalQuestions, { message: 'score cannot exceed totalQuestions' })

export async function POST(req: NextRequest) {
  try {
    // Many attendees share one venue Wi-Fi IP, so this stays generous --
    // it's only here to blunt scripted abuse, not to gate real phones.
    const limited = await rateLimit(getClientIp(req), 'ocbn-leaderboard-submit', { limit: 60, windowSeconds: 3600 })
    if (limited) return limited

    const parsed = await validateBody(req, submitSchema)
    if ('error' in parsed) return parsed.error
    const { eventKey, firstName, score, totalQuestions, timeSeconds, honeypot } = parsed.data

    if (honeypot) {
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 400 })
    }

    const { error: insertError } = await supabaseAdmin.from('ocbn_demo_leaderboard').insert({
      event_key: eventKey,
      first_name: firstName,
      score,
      total_questions: totalQuestions,
      time_seconds: timeSeconds,
    })

    if (insertError) {
      return NextResponse.json({ error: insertError.message || 'Could not save your score.' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('ocbn-demo/leaderboard POST error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const limited = await rateLimit(getClientIp(req), 'ocbn-leaderboard-read', { limit: 120, windowSeconds: 3600 })
    if (limited) return limited

    const eventKey = req.nextUrl.searchParams.get('eventKey')?.trim() || DEFAULT_EVENT_KEY

    const { data, error } = await supabaseAdmin
      .from('ocbn_demo_leaderboard')
      .select('first_name, score, total_questions, time_seconds, submitted_at')
      .eq('event_key', eventKey)
      .order('score', { ascending: false })
      .order('time_seconds', { ascending: true })
      .limit(LEADERBOARD_LIMIT)

    if (error) {
      return NextResponse.json({ error: error.message || 'Could not load the leaderboard.' }, { status: 400 })
    }

    return NextResponse.json({
      entries: (data || []).map((row) => ({
        firstName: row.first_name,
        score: row.score,
        totalQuestions: row.total_questions,
        timeSeconds: row.time_seconds,
      })),
    })
  } catch (err) {
    console.error('ocbn-demo/leaderboard GET error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
