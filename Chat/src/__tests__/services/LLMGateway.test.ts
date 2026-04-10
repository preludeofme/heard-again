import { LLMGatewayImpl } from '../../services/llm/LLMGateway'

describe('LLMGatewayImpl.validateResponse', () => {
  let gateway: LLMGatewayImpl

  beforeEach(() => {
    gateway = new LLMGatewayImpl('http://localhost:11434', 'llama3.1:8b-instruct')
  })

  it('accepts the canonical refusal without violations', async () => {
    const response = "I don't have that documented in the materials I was given."

    const validated = await gateway.validateResponse(response, {
      documents: ['Grandma loved gardening and baking pies.'],
      knownFacts: ['Grandma lived in Ohio.'],
    })

    expect(validated.isValid).toBe(true)
    expect(validated.violations).toHaveLength(0)
    expect(validated.filteredContent).toBe(response)
  })

  it('flags unsupported claims when evidence does not back them', async () => {
    const response = 'I moved to Seattle in 1987 and started teaching at the university.'

    const validated = await gateway.validateResponse(response, {
      documents: ['I grew up in rural Iowa and worked on the family farm.'],
      knownFacts: ['I enjoyed fishing on weekends.'],
    })

    expect(validated.violations.some(v => v.type === 'unsupported_claim')).toBe(true)
    expect(validated.isValid).toBe(false)
  })

  it('does not flag supported claims found in retrieved documents', async () => {
    const response = 'I grew up in rural Iowa and worked on the family farm for many years.'

    const validated = await gateway.validateResponse(response, {
      documents: ['Memoir excerpt: I grew up in rural Iowa and worked on the family farm for many years.'],
      knownFacts: [],
    })

    expect(validated.violations.some(v => v.type === 'unsupported_claim')).toBe(false)
  })

  it('treats known facts as valid evidence support', async () => {
    const response = 'My favorite pastime was restoring old radios in my garage workshop.'

    const validated = await gateway.validateResponse(response, {
      documents: ['Diary note: Today I cleaned the garage and read the paper.'],
      knownFacts: ['My favorite pastime was restoring old radios in my garage workshop.'],
    })

    expect(validated.violations.some(v => v.type === 'unsupported_claim')).toBe(false)
    expect(validated.isValid).toBe(true)
  })
})
