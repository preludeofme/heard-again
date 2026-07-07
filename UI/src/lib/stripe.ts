import Stripe from 'stripe'

const globalForStripe = globalThis as unknown as {
  stripe: Stripe | undefined
}

function createStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY

  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }

  return new Stripe(secretKey, {
    apiVersion: '2026-06-24.dahlia',
    typescript: true,
  })
}

const stripe = globalForStripe.stripe ?? createStripeClient()

if (process.env.NODE_ENV !== 'production') {
  globalForStripe.stripe = stripe
}

export { stripe }
export default stripe
