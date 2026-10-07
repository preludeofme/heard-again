/**
 * Marketing copy for the public cloud tiers.
 *
 * Everything here is prose we write. Every number — price, voice minutes,
 * storage, voice profiles — comes from the `Plan` row at request time, so this
 * file can never disagree with Stripe.
 *
 * The keys are also the allowlist: a `Plan` row with no entry here never reaches
 * the public page, which keeps internal and experimental tiers off the site.
 */

/** A copy line we author, as opposed to a fact read off the row. */
export type ProseFeature = {
  kind: 'prose'
  text: string
  /** Bold the whole line, for the points the tier is sold on. */
  isStrong?: boolean
  /** Section heading inside the list, e.g. "Includes all Starter features PLUS:". */
  isLead?: boolean
}

/** A placeholder the card fills in from the `Plan` row. */
export type PlanFactFeature = {
  kind: 'fact'
  field: 'minutes' | 'storage' | 'voiceProfiles' | 'prioritySupport'
}

export type LandingFeature = ProseFeature | PlanFactFeature

export type LandingPlanCopy = {
  subtitle: string
  bestFor: string
  isRecommended: boolean
  features: LandingFeature[]
  ctaText: string
  trialNote: string
  /** Used when the row is inactive or has no Stripe price: keep the price, drop the dead checkout. */
  unavailable: {
    note: string
    ctaText: string
    ctaHref: string
  }
}

const prose = (text: string): ProseFeature => ({ kind: 'prose', text })
const strongProse = (text: string): ProseFeature => ({ kind: 'prose', text, isStrong: true })
const lead = (text: string): ProseFeature => ({ kind: 'prose', text, isLead: true })
const fact = (field: PlanFactFeature['field']): PlanFactFeature => ({ kind: 'fact', field })

export const LANDING_PLAN_COPY: Record<string, LandingPlanCopy> = {
  cloud_lite: {
    subtitle: 'For sharing and hosting stories, images, and data without AI features.',
    features: [
      strongProse('No setup required'),
      strongProse('Secure managed hosting'),
      strongProse('Automatic backups & updates'),
      fact('storage'),
      prose('Easy family sharing'),
      prose('Consent and privacy tools'),
      prose('Support included'),
      fact('minutes'),
    ],
    bestFor: 'Best for families who just want standard hosting and media/story sharing.',
    isRecommended: false,
    ctaText: 'Start free trial',
    trialNote: 'Includes 14-day free trial',
    unavailable: {
      note: 'Not open for signup yet',
      ctaText: 'Start with Starter instead',
      ctaHref: '/signup?plan=cloud_min',
    },
  },
  cloud_min: {
    subtitle: 'For families who want a simple, secure hosted option.',
    features: [
      strongProse('No setup required'),
      strongProse('Secure managed hosting'),
      strongProse('Automatic backups & updates'),
      fact('minutes'),
      fact('storage'),
      fact('voiceProfiles'),
      prose('Easy family sharing'),
      prose('Consent and privacy tools'),
      prose('Support included'),
    ],
    bestFor: 'Best for families just beginning to preserve their stories.',
    isRecommended: false,
    ctaText: 'Start free trial',
    trialNote: 'Includes 14-day free trial',
    unavailable: {
      note: 'Not open for signup yet',
      ctaText: 'See the Family plan',
      ctaHref: '/signup?plan=cloud_mid',
    },
  },
  cloud_mid: {
    subtitle: 'For families actively building their legacy library.',
    features: [
      lead('Includes all Starter features PLUS:'),
      fact('minutes'),
      fact('storage'),
      strongProse('Priority voice processing'),
      prose('Advanced family tree linking'),
      fact('prioritySupport'),
      prose('Easy family sharing'),
    ],
    bestFor: 'Best for families collecting stories from multiple relatives and contributors.',
    isRecommended: true,
    ctaText: 'Start free trial',
    trialNote: 'Includes 14-day free trial',
    unavailable: {
      note: 'Not open for signup yet',
      ctaText: 'Start with Starter instead',
      ctaHref: '/signup?plan=cloud_min',
    },
  },
  cloud_max: {
    subtitle: 'For families preserving a large collection of voices, memories, and stories.',
    features: [
      lead('Includes all Family features PLUS:'),
      fact('minutes'),
      fact('storage'),
      fact('prioritySupport'),
      strongProse('Dedicated success manager'),
    ],
    bestFor: 'Best for families building a long-term family legacy library.',
    isRecommended: false,
    ctaText: 'Choose Legacy',
    trialNote: 'Includes 14-day free trial',
    unavailable: {
      note: 'Not open for signup yet',
      ctaText: 'Start with Starter instead',
      ctaHref: '/signup?plan=cloud_min',
    },
  },
}

/** Cheapest first, matching the order the cards are laid out in. */
export const PUBLIC_PLAN_SLUGS = ['cloud_lite', 'cloud_min', 'cloud_mid', 'cloud_max'] as const
