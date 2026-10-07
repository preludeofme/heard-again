import type { PublicPlan } from './public-plans.types'

/**
 * The sentinel `generationMinutesIncluded` the Legacy tier is seeded with to mean
 * "we do not meter this". Kept as a threshold rather than an equality test so a
 * future larger allowance still reads as unlimited instead of "999999 minutes".
 */
export const UNLIMITED_GENERATION_MINUTES = 999_999

/** One run of words in a plan fact, so the page can bold the number without owning the wording. */
export type PlanFactSegment = { text: string; isStrong?: boolean }

/** A single entitlement line derived from a `Plan` row. */
export type PlanFact = {
  segments: PlanFactSegment[]
  /** True for an entitlement the tier does not include, so the page can dim it rather than drop it. */
  isMuted?: boolean
}

export function isUnlimitedGeneration(minutes: number): boolean {
  return minutes >= UNLIMITED_GENERATION_MINUTES
}

/** 999 -> "9.99". The cards print dollars; the row stores cents. */
export function formatMonthlyPrice(priceMonthlyCents: number): string {
  return (priceMonthlyCents / 100).toFixed(2)
}

export function planFactToText(fact: PlanFact): string {
  return fact.segments.map((segment) => segment.text).join('')
}

/**
 * Buyer-facing voice allowance.
 *
 * Zero minutes must read as an explicit denial, never as a blank or a dropped
 * line: Cloud Access Lite includes no voice generation and the page has to say so.
 */
export function generationMinutesFact(minutes: number): PlanFact {
  if (isUnlimitedGeneration(minutes)) {
    return { segments: [{ text: 'Unlimited voice generation', isStrong: true }] }
  }
  if (minutes <= 0) {
    return {
      segments: [{ text: 'No voice generation or voice clones' }],
      isMuted: true,
    }
  }
  return {
    segments: [{ text: `${minutes} minutes`, isStrong: true }, { text: ' of voice generation / mo' }],
  }
}

/** 2147483648 -> "2 GB cloud storage". Whole units lose the trailing ".0". */
export function storageQuotaFact(storageQuotaBytes: number): PlanFact {
  if (storageQuotaBytes <= 0) {
    return { segments: [{ text: 'No cloud storage' }], isMuted: true }
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(
    Math.floor(Math.log(storageQuotaBytes) / Math.log(1024)),
    units.length - 1
  )
  const value = storageQuotaBytes / Math.pow(1024, exponent)
  const rounded = value.toFixed(1).replace(/\.0$/, '')

  return {
    segments: [{ text: `${rounded} ${units[exponent]}`, isStrong: true }, { text: ' cloud storage' }],
  }
}

export function voiceProfileQuotaFact(voiceProfileQuota: number): PlanFact | null {
  if (voiceProfileQuota <= 0) {
    return null
  }
  return {
    segments: [{ text: 'Up to ' }, { text: `${voiceProfileQuota} voice profiles`, isStrong: true }],
  }
}

export function prioritySupportFact(hasPrioritySupport: boolean): PlanFact | null {
  if (!hasPrioritySupport) {
    return null
  }
  return { segments: [{ text: 'Priority support response', isStrong: true }] }
}

/** The cheapest advertised tier that includes no voice minutes at all, if there is one. */
export function findNoVoiceTier(plans: readonly PublicPlan[]): PublicPlan | null {
  return (
    plans
      .filter((plan) => plan.generationMinutesIncluded <= 0)
      .sort((a, b) => a.priceMonthlyCents - b.priceMonthlyCents)[0] ?? null
  )
}

/** The cheapest advertised tier a buyer can actually buy voice generation on. */
export function findEntryVoiceTier(plans: readonly PublicPlan[]): PublicPlan | null {
  return (
    plans
      .filter((plan) => plan.generationMinutesIncluded > 0 && plan.isAvailable)
      .sort((a, b) => a.priceMonthlyCents - b.priceMonthlyCents)[0] ?? null
  )
}
