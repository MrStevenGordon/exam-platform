import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/verifySystemAdmin'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const PRICE_IDS: Record<string, string | undefined> = {
  '3_month': process.env.STRIPE_PRICE_3_MONTH,
  '6_month': process.env.STRIPE_PRICE_6_MONTH,
  yearly: process.env.STRIPE_PRICE_YEARLY,
}

export async function POST(req: NextRequest) {
  try {
    const { plan, accessToken } = await req.json()

    const priceId = PRICE_IDS[plan]
    if (!priceId) {
      return NextResponse.json({ error: 'Invalid plan.' }, { status: 400 })
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken)
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
    }

    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, name, contact_email')
      .eq('auth_user_id', userData.user.id)
      .single()

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found.' }, { status: 404 })
    }

    // Ensure a subscription row exists — organization_subscriptions is
    // service-role-write-only, so the org's own client can never create it.
    const { data: existingSub } = await supabaseAdmin
      .from('organization_subscriptions')
      .select('stripe_customer_id')
      .eq('organization_id', org.id)
      .maybeSingle()

    let stripeCustomerId = existingSub?.stripe_customer_id

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({ email: org.contact_email, name: org.name, metadata: { organization_id: org.id } })
      stripeCustomerId = customer.id
      await supabaseAdmin
        .from('organization_subscriptions')
        .upsert({ organization_id: org.id, stripe_customer_id: stripeCustomerId }, { onConflict: 'organization_id' })
    }

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || ''

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: org.id,
      metadata: { organization_id: org.id, plan },
      success_url: `${origin}/org/billing?success=1`,
      cancel_url: `${origin}/org/billing?canceled=1`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('stripe-checkout error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
