/**
 * The subset of a `Plan` row that the public pricing surfaces are allowed to read.
 *
 * Serialisable on purpose: these cross the `getStaticProps` / `getServerSideProps`
 * boundary, so `storageQuotaBytes` is a `number` rather than Prisma's `BigInt`.
 */
export type PublicPlan = {
  id: string
  slug: string
  name: string
  planType: string
  priceMonthlyCents: number
  /** `priceMonthlyCents` as the dollars string the cards print, e.g. "9.99". */
  priceMonthlyDisplay: string
  generationMinutesIncluded: number
  storageQuotaBytes: number
  memberQuota: number
  voiceProfileQuota: number
  prioritySupport: boolean
  /**
   * True only when a buyer can actually complete checkout for this tier:
   * the row is active and has a monthly Stripe price to send them to.
   *
   * A row with `isActive: false` still renders — it keeps its advertised price
   * but offers no checkout. To stop advertising a tier at all, remove its row
   * or its copy entry in `landing-plan-copy.ts`.
   */
  isAvailable: boolean
}
