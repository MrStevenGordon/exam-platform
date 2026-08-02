import { NextResponse } from 'next/server'
import Stripe from 'stripe'

// Constructed lazily, not at module scope — Stripe isn't configured yet
// (dormant pending a Jamaica-compatible provider), and building the Stripe
// client at import time crashes the whole build when the key is missing.
function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}

const PLAN_KEYS: { key: string; envVar: string; label: string }[] = [
  { key: '3_month', envVar: 'STRIPE_PRICE_3_MONTH', label: '3 Months' },
  { key: '6_month', envVar: 'STRIPE_PRICE_6_MONTH', label: '6 Months' },
  { key: 'yearly', envVar: 'STRIPE_PRICE_YEARLY', label: 'Yearly' },
]

export async function GET() {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ plans: [] })
  }
  try {
    const stripe = getStripe()
    const plans = []
    for (const p of PLAN_KEYS) {
      const priceId = process.env[p.envVar]
      if (!priceId) continue
      const price = await stripe.prices.retrieve(priceId)
      plans.push({ key: p.key, label: p.label, amountUsd: (price.unit_amount || 0) / 100 })
    }
    return NextResponse.json({ plans })
  } catch (err) {
    console.error('stripe-plans error:', err)
    return NextResponse.json({ error: 'Could not load plans.' }, { status: 500 })
  }
}
