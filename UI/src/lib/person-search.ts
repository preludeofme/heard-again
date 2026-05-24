import type { Prisma } from '@prisma/client'

export type PersonNameSearchField =
  | 'firstName'
  | 'middleName'
  | 'lastName'
  | 'maidenName'
  | 'displayName'
  | 'nickname'

export const PERSON_NAME_SEARCH_FIELDS: PersonNameSearchField[] = [
  'firstName',
  'middleName',
  'lastName',
  'maidenName',
  'displayName',
  'nickname',
]

export function getPersonSearchTokens(search?: string | null): string[] {
  return search?.trim().split(/\s+/).filter(Boolean) ?? []
}

export function buildPersonNameSearchWhere(tokens: string[]): Prisma.PersonWhereInput[] {
  return tokens.map(token => ({
    OR: PERSON_NAME_SEARCH_FIELDS.map(field => ({
      [field]: { contains: token, mode: 'insensitive' as const },
    })),
  }))
}
