import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const MONTHLY_LIMIT = 5

export async function POST(req: NextRequest) {
  try {
    const { questionType, questionText, options, teacherId } = await req.json()

    if (!questionText || questionText.trim() === '') {
      return NextResponse.json({ error: 'Question text is required.' }, { status: 400 })
    }

    if (!teacherId) {
      return NextResponse.json({ error: 'Teacher ID is required.' }, { status: 400 })
    }

    // Check monthly usage
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const monthYear = new Date().toISOString().slice(0, 7) // e.g. '2026-07'

    const { count } = await supabase
      .from('ai_polish_usage')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacherId)
      .eq('month_year', monthYear)

    const usedCount = count || 0

    if (usedCount >= MONTHLY_LIMIT) {
      return NextResponse.json({
        error: `Monthly AI polish limit reached. You have used ${usedCount}/${MONTHLY_LIMIT} polishes this month. Limit resets on the 1st of next month.`,
        limit_reached: true,
        used: usedCount,
        limit: MONTHLY_LIMIT,
      }, { status: 429 })
    }

    // Build prompt
    let prompt = ''
    if (questionType === 'multiple_choice') {
      prompt = `You are helping a teacher polish a multiple-choice exam question. Improve the clarity and grammar of the question stem, and suggest plausible but incorrect distractor options if any of the given options seem weak or too obviously wrong. Do NOT change the meaning of the question or suggest a different correct answer.

Original question: "${questionText}"
Original options: ${JSON.stringify(options)}

Respond ONLY with valid JSON in this exact format, no other text:
{"improved_question": "...", "improved_options": ["...", "...", "...", "..."]}`
    } else {
      prompt = `You are helping a teacher polish an exam question. Improve the clarity, grammar, and precision of the wording. Do NOT change the meaning or the type of question.

Original question: "${questionText}"

Respond ONLY with valid JSON in this exact format, no other text:
{"improved_question": "..."}`
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Anthropic API error:', errText)
      let detail = 'AI request failed.'
      try {
        const parsedErr = JSON.parse(errText)
        if (parsedErr?.error?.message) detail = parsedErr.error.message
      } catch {}
      return NextResponse.json({ error: detail }, { status: 500 })
    }

    const data = await response.json()
    const text = data.content?.[0]?.text || ''
    const cleaned = text.replace(/```json|```/g, '').trim()

    let parsed
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({ error: 'AI returned an unexpected format. Try again.' }, { status: 500 })
    }

    // Record usage
    await supabase.from('ai_polish_usage').insert({
      teacher_id: teacherId,
      month_year: monthYear,
    })

    return NextResponse.json({
      ...parsed,
      usage: { used: usedCount + 1, limit: MONTHLY_LIMIT, remaining: MONTHLY_LIMIT - usedCount - 1 }
    })

  } catch (err: any) {
    console.error('Polish question error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
