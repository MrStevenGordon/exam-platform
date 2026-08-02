import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/verifySystemAdmin'

// Constructed lazily, not at module scope — Stripe isn't configured yet
// (dormant pending a Jamaica-compatible provider), and building the Stripe
// client at import time crashes the whole build when the key is missing.
function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}

async function upsertSubscription(organizationId: string, fields: Record<string, unknown>) {
  await supabaseAdmin
    .from('organization_subscriptions')
    .upsert({ organization_id: organizationId, updated_at: new Date().toISOString(), ...fields }, { onConflict: 'organization_id' })
}

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe is not configured.' }, { status: 503 })
  }

  const stripe = getStripe()
  const signature = req.headers.get('stripe-signature')
  const rawBody = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature!, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const organizationId = session.client_reference_id || session.metadata?.organization_id
        if (!organizationId) break

        const subscriptionId = session.subscription as string
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)

        await upsertSubscription(organizationId, {
          subscription_status: 'active',
          subscription_plan: session.metadata?.plan || null,
          current_period_end: new Date(subscription.items.data[0].current_period_end * 1000).toISOString(),
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: subscriptionId,
        })
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = (invoice as unknown as { subscription: string | null }).subscription
        if (!subscriptionId) break

        const { data: sub } = await supabaseAdmin
          .from('organization_subscriptions')
          .select('organization_id')
          .eq('stripe_subscription_id', subscriptionId)
          .maybeSingle()
        if (!sub) break

        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        await upsertSubscription(sub.organization_id, {
          subscription_status: 'active',
          current_period_end: new Date(subscription.items.data[0].current_period_end * 1000).toISOString(),
        })
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const { data: sub } = await supabaseAdmin
          .from('organization_subscriptions')
          .select('organization_id')
          .eq('stripe_subscription_id', subscription.id)
          .maybeSingle()
        if (!sub) break

        const status = subscription.status === 'active' ? 'active' : subscription.status === 'past_due' ? 'past_due' : 'canceled'
        await upsertSubscription(sub.organization_id, { subscription_status: status })
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('stripe-webhook handling error:', err)
    return NextResponse.json({ error: 'Webhook handler failed.' }, { status: 500 })
  }
}
