import { buildPersonNameSearchWhere, getPersonSearchTokens, PERSON_NAME_SEARCH_FIELDS } from '@/lib/person-search'

describe('person-search helpers', () => {
  it('uses one shared field list for person-name matching', () => {
    expect(PERSON_NAME_SEARCH_FIELDS).toEqual([
      'firstName',
      'middleName',
      'lastName',
      'maidenName',
      'displayName',
      'nickname',
    ])
  })

  it('tokenizes trimmed whitespace-separated search text', () => {
    expect(getPersonSearchTokens('  Mary   Ann  ')).toEqual(['Mary', 'Ann'])
    expect(getPersonSearchTokens('   ')).toEqual([])
    expect(getPersonSearchTokens(undefined)).toEqual([])
  })

  it('builds AND-compatible clauses with case-insensitive contains matching across every name field', () => {
    expect(buildPersonNameSearchWhere(['rya'])).toEqual([
      {
        OR: [
          { firstName: { contains: 'rya', mode: 'insensitive' } },
          { middleName: { contains: 'rya', mode: 'insensitive' } },
          { lastName: { contains: 'rya', mode: 'insensitive' } },
          { maidenName: { contains: 'rya', mode: 'insensitive' } },
          { displayName: { contains: 'rya', mode: 'insensitive' } },
          { nickname: { contains: 'rya', mode: 'insensitive' } },
        ],
      },
    ])
  })
})
