import {
  ValidatedResponse,
  ContentViolation,
} from '@/types'

const CANONICAL_REFUSAL_MESSAGE = "I don't have that documented in the materials I was given."
const REFUSAL_TEMPLATE_PREFIXES = [
  "i don't have that documented in the materials i was given",
  "that detail isn't in the records i have available",
  "i can't find that in the materials i was given",
  "i don't recall that from the information i have",
  "that's not something i have documented in my memories",
]
const CLAIM_STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'than', 'to', 'of', 'in', 'on', 'at', 'for',
  'from', 'by', 'with', 'without', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'it',
  'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'they',
  'them', 'his', 'her', 'their', 'do', 'does', 'did', 'have', 'has', 'had', 'about', 'into', 'over',
  'under', 'after', 'before', 'during', 'can', 'could', 'would', 'should', 'just', 'very', 'also',
])

export interface ValidationContext {
  documents?: string[]
  knownFacts?: string[]
}

export class ResponseValidationService {
  async validateResponse(response: string, context?: ValidationContext): Promise<ValidatedResponse> {
    const violations: ContentViolation[] = []
    const normalizedResponse = this.normalizeText(response)

    if (this.isRefusalTemplate(normalizedResponse)) {
      return {
        isValid: true,
        content: response,
        violations: [],
        filteredContent: response,
      }
    }

    // Check for prompt injection attempts
    const injectionPatterns = [
      /ignore\s+(previous|all)\s+(instructions|prompts)/gi,
      /system\s*:\s*you\s+are\s+now/gi,
      /act\s+as\s+a\s+different/gi,
      /forget\s+everything\s+above/gi
    ]

    for (const pattern of injectionPatterns) {
      const matches = response.match(pattern)
      if (matches) {
        violations.push({
          type: 'prompt_injection',
          severity: 'high',
          description: 'Potential prompt injection detected',
          position: {
            start: response.indexOf(matches[0]),
            end: response.indexOf(matches[0]) + matches[0].length
          }
        })
      }
    }

    // Check for PII leakage (basic patterns)
    const piiPatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
      /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // Credit card
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g // Email
    ]

    for (const pattern of piiPatterns) {
      const matches = response.match(pattern)
      if (matches) {
        violations.push({
          type: 'pii_leak',
          severity: 'medium',
          description: 'Potential PII detected',
          position: {
            start: response.indexOf(matches[0]),
            end: response.indexOf(matches[0]) + matches[0].length
          }
        })
      }
    }

    // Check for inappropriate content (basic keyword filtering)
    const inappropriatePatterns = [
      /\b(hate|kill|harm|violence|abuse)\b/gi
    ]

    for (const pattern of inappropriatePatterns) {
      const matches = response.match(pattern)
      if (matches) {
        violations.push({
          type: 'inappropriate_content',
          severity: 'medium',
          description: 'Inappropriate content detected',
          position: {
            start: response.indexOf(matches[0]),
            end: response.indexOf(matches[0]) + matches[0].length
          }
        })
      }
    }

    // === HALLUCINATION DETECTION ===
    
    // Check for speculative language that suggests fabrication
    const uncertaintyStylePatterns = [
      { pattern: /\b(I think|I believe|perhaps|maybe|probably|likely|I suppose|I guess|I imagine)\b/gi, severity: 'low' },
      { pattern: /\b(it seems|it appears|it looks like|apparently)\b/gi, severity: 'low' },
      { pattern: /\b(if I recall correctly|if memory serves|as far as I remember|I can'?t quite recall)\b/gi, severity: 'low' },
    ]

    for (const { pattern, severity } of uncertaintyStylePatterns) {
      const matches = response.match(pattern)
      if (matches) {
        violations.push({
          type: 'uncertainty_style',
          severity: severity as 'low' | 'medium' | 'high',
          description: `Uncertainty language detected: "${matches[0]}"`,
          position: {
            start: response.indexOf(matches[0]),
            end: response.indexOf(matches[0]) + matches[0].length
          }
        })
      }
    }

    // Check for specific name/date/place invention patterns
    const inventionPatterns = [
      { pattern: /\b(my (wife|husband|spouse|partner) (was|is named|name was)\s+)([A-Z][a-z]+)/g, severity: 'high' },
      { pattern: /\b(my (son|daughter|child) (was|is named|name was)\s+)([A-Z][a-z]+)/g, severity: 'high' },
      { pattern: /\b(I had \d+ (children|kids|sons|daughters))/gi, severity: 'high' },
      { pattern: /\b(we moved to|I moved to|I lived in|we lived in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g, severity: 'high' },
      { pattern: /\b(I was born in|born on)\s+(\d{1,4}|January|February|March|April|May|June|July|August|September|October|November|December)/gi, severity: 'high' },
    ]

    for (const { pattern, severity } of inventionPatterns) {
      const matches = [...response.matchAll(pattern)]
      for (const match of matches) {
        violations.push({
          type: 'potential_hallucination',
          severity: severity as 'low' | 'medium' | 'high',
          description: `Potential fabricated detail: "${match[0]}"`,
          position: {
            start: match.index || 0,
            end: (match.index || 0) + match[0].length
          }
        })
      }
    }

    // Check if response contradicts provided context (if available)
    if (context?.documents && context.documents.length > 0) {
      const documentSupport = this.checkDocumentSupport(
        response,
        context.documents,
        context.knownFacts || []
      )

      if (!documentSupport.supported && documentSupport.unsupportedClaims.length > 0) {
        const unsupportedHighSpecificityCount = documentSupport.unsupportedClaims.filter(c => c.highSpecificity).length
        violations.push({
          type: 'unsupported_claim',
          severity: unsupportedHighSpecificityCount > 0 ? 'high' : 'medium',
          description: `Claims without evidence support: ${documentSupport.unsupportedClaims.slice(0, 3).map(c => c.claim).join(', ')}${documentSupport.unsupportedClaims.length > 3 ? '...' : ''}`,
        })
      }
    }

    // Check for "I don't know" variations that might be bypassing uncertainty phrases
    const bypassPatterns = [
      /I don't know (much|a lot|very much) about/gi,
      /I'm not (an expert|sure about all the details|entirely certain)/gi,
      /I (can't|couldn't) tell you (much|anything|specifics)/gi,
    ]

    for (const pattern of bypassPatterns) {
      const matches = response.match(pattern)
      if (matches) {
        violations.push({
          type: 'uncertainty_bypass',
          severity: 'medium',
          description: 'Response may be bypassing required canonical refusal format',
          position: {
            start: response.indexOf(matches[0]),
            end: response.indexOf(matches[0]) + matches[0].length
          }
        })
      }
    }

    const isValid = violations.length === 0 || violations.every(v => v.severity === 'low')

    return {
      isValid,
      content: response,
      violations,
      filteredContent: isValid ? response : this.filterContent(response, violations)
    }
  }

  /**
   * Check if response claims are supported by provided documents
   */
  private checkDocumentSupport(
    response: string,
    documents: string[],
    knownFacts: string[]
  ): {
    supported: boolean
    checkedClaims: string[]
    unsupportedClaims: Array<{ claim: string, highSpecificity: boolean }>
  } {
    const claims = this.extractAtomicClaims(response)
    if (claims.length === 0) {
      return {
        supported: true,
        checkedClaims: [],
        unsupportedClaims: [],
      }
    }

    const normalizedEvidence = [...documents, ...knownFacts]
      .map(item => this.normalizeText(item))
      .filter(item => item.length > 0)

    const unsupportedClaims = claims
      .map((claim) => ({
        claim,
        supportScore: this.getEvidenceSupportScore(claim, normalizedEvidence),
      }))
      .filter(item => item.supportScore < 0.7)
      .map(item => ({
        claim: item.claim,
        highSpecificity: this.isHighSpecificityClaim(item.claim),
      }))

    return {
      supported: unsupportedClaims.length === 0,
      checkedClaims: claims,
      unsupportedClaims,
    }
  }

  private extractAtomicClaims(response: string): string[] {
    return response
      .split(/[.!?]+/)
      .map(part => part.trim())
      .filter(part => part.length >= 20)
      .filter(part => !part.endsWith('?'))
      .filter(part => this.normalizeText(part) !== this.normalizeText(CANONICAL_REFUSAL_MESSAGE))
      .filter(part => {
        const normalized = this.normalizeText(part)
        return !(
          normalized.startsWith("i don't know") ||
          normalized.startsWith("i do not know") ||
          normalized.startsWith("i am not sure")
        )
      })
  }

  private getEvidenceSupportScore(claim: string, normalizedEvidence: string[]): number {
    const normalizedClaim = this.normalizeText(claim)
    if (!normalizedClaim) {
      return 1
    }

    if (normalizedEvidence.some(item => item.includes(normalizedClaim))) {
      return 1
    }

    const keywords = this.extractClaimKeywords(normalizedClaim)
    if (keywords.length === 0) {
      return 1
    }

    let bestRatio = 0
    for (const evidence of normalizedEvidence) {
      const matches = keywords.filter(keyword => evidence.includes(keyword)).length
      const ratio = matches / keywords.length
      bestRatio = Math.max(bestRatio, ratio)
    }

    return bestRatio
  }

  private extractClaimKeywords(normalizedClaim: string): string[] {
    return normalizedClaim
      .split(' ')
      .map(token => token.trim())
      .filter(token => token.length > 2)
      .filter(token => !CLAIM_STOP_WORDS.has(token))
  }

  private normalizeText(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private isRefusalTemplate(normalizedResponse: string): boolean {
    return REFUSAL_TEMPLATE_PREFIXES.some(prefix => normalizedResponse.startsWith(prefix))
  }

  private isHighSpecificityClaim(claim: string): boolean {
    const normalized = claim.toLowerCase()
    const hasYearOrDate = /\b(19|20)\d{2}\b/.test(normalized) || /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/.test(normalized)
    const hasRelationship = /\b(wife|husband|spouse|partner|son|daughter|child|children|mother|father)\b/.test(normalized)
    const hasCount = /\b\d+\b/.test(normalized)

    return hasYearOrDate || hasRelationship || hasCount
  }

  private filterContent(content: string, violations: ContentViolation[]): string {
    let filteredContent = content

    // Sort violations by position in reverse order to avoid index shifting
    const sortedViolations = violations
      .filter(v => v.position)
      .sort((a, b) => b.position!.start - a.position!.start)

    for (const violation of sortedViolations) {
      if (violation.position) {
        filteredContent = 
          filteredContent.slice(0, violation.position.start) +
          '[CONTENT_FILTERED]' +
          filteredContent.slice(violation.position.end)
      }
    }

    return filteredContent
  }
}

export const responseValidationService = new ResponseValidationService()
