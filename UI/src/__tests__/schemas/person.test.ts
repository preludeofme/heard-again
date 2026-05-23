import { updatePersonSchema } from '@/schemas'

describe('updatePersonSchema', () => {
  it('accepts null dates when a person edit clears optional date fields', () => {
    const result = updatePersonSchema.safeParse({
      firstName: 'Ada',
      birthDate: null,
      deathDate: null,
      isDeceased: false,
    })

    expect(result.success).toBe(true)
  })

  it('rejects empty string dates so clients must normalize blank date inputs', () => {
    const result = updatePersonSchema.safeParse({
      firstName: 'Ada',
      birthDate: '',
      deathDate: '',
      isDeceased: false,
    })

    expect(result.success).toBe(false)
  })
})
