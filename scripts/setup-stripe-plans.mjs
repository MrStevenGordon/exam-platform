// Creates the "Smart Assess — Organization Plan" Stripe Product plus its
// three recurring Prices (3-month, 6-month, yearly). Run once per Stripe
// account (test mode first, then again in live mode when ready).
//
// Usage:
//   STRIPE_SECRET_KEY=sk_test_... PRICE_3_MONTH_USD=29 PRICE_6_MONTH_USD=49 PRICE_YEARLY_USD=89 node scripts/setup-stripe-plans.mjs

import Stripe from 'stripe'

const secretKey = process.env.STRIPE_SECRET_KEY
if (!secretKey) {
  console.error('Set STRIPE_SECRET_KEY first (from your Stripe dashboard → Developers → API keys).')
  process.exit(1)
}

const price3Month = process.env.PRICE_3_MONTH_USD
const price6Month = process.env.PRICE_6_MONTH_USD
const priceYearly = process.env.PRICE_YEARLY_USD
if (!price3Month || !price6Month || !priceYearly) {
  console.error('Set PRICE_3_MONTH_USD, PRICE_6_MONTH_USD, and PRICE_YEARLY_USD (whole dollar amounts, e.g. 29).')
  process.exit(1)
}

const stripe = new Stripe(secretKey)

async function main() {
  const product = await stripe.products.create({ name: 'Smart Assess — Organization Plan' })
  console.log('Created product:', product.id)

  const plans = [
    { key: '3_month', amount: price3Month, interval: 'month', interval_count: 3 },
    { key: '6_month', amount: price6Month, interval: 'month', interval_count: 6 },
    { key: 'yearly', amount: priceYearly, interval: 'year', interval_count: 1 },
  ]

  console.log('\nAdd these to .env.local:\n')
  for (const plan of plans) {
    const price = await stripe.prices.create({
      product: product.id,
      currency: 'usd',
      unit_amount: Math.round(Number(plan.amount) * 100),
      recurring: { interval: plan.interval, interval_count: plan.interval_count },
    })
    const envVar = `STRIPE_PRICE_${plan.key.toUpperCase()}`
    console.log(`${envVar}=${price.id}`)
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
