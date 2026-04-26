export interface ParsedIndividual {
  xref: string
  firstName: string
  lastName: string | null
  fullName: string
  nickname: string | null
  sex: 'M' | 'F' | 'U' | 'X' | null
  birthDate: Date | null
  birthPlace: string | null
  deathDate: Date | null
  deathPlace: string | null
  note: string | null
}

export interface ParsedFamily {
  xref: string
  husbandXref: string | null
  wifeXref: string | null
  childXrefs: string[]
  marriageDate: Date | null
  marriagePlace: string | null
  divorceDate: Date | null
}

export class GedcomParser {
  static parse(content: string): { individuals: ParsedIndividual[]; families: ParsedFamily[] } {
    const lines = content.split(/\r?\n/)
    const individuals: ParsedIndividual[] = []
    const families: ParsedFamily[] = []

    let index = 0
    while (index < lines.length) {
      const line = lines[index].trim()
      const level0 = line.match(/^0\s+(@[^@]+@)\s+(INDI|FAM)$/)
      if (!level0) {
        index += 1
        continue
      }

      const xref = level0[1]
      const recordType = level0[2]
      const block: string[] = []
      index += 1

      while (index < lines.length && !/^0\s+/.test(lines[index].trim())) {
        block.push(lines[index].trim())
        index += 1
      }

      if (recordType === 'INDI') {
        individuals.push(this.parseIndividual(xref, block))
      } else if (recordType === 'FAM') {
        families.push(this.parseFamily(xref, block))
      }
    }

    return { individuals, families }
  }

  private static parseIndividual(xref: string, block: string[]): ParsedIndividual {
    let firstName = 'Unknown'
    let lastName: string | null = null
    let fullName = 'Unknown'
    let nickname: string | null = null
    let sex: 'M' | 'F' | 'U' | 'X' | null = null
    let birthDate: Date | null = null
    let birthPlace: string | null = null
    let deathDate: Date | null = null
    let deathPlace: string | null = null
    const notes: string[] = []

    for (let i = 0; i < block.length; i += 1) {
      const entry = block[i]
      const nameMatch = entry.match(/^1\s+NAME\s+(.+)$/)
      if (nameMatch && fullName === 'Unknown') {
        const parsed = this.parseNameValue(nameMatch[1])
        firstName = parsed.firstName
        lastName = parsed.lastName
        fullName = parsed.fullName
      }

      const nickMatch = entry.match(/^1\s+NICK\s+(.+)$/)
      if (nickMatch) {
        nickname = nickMatch[1].trim()
      }

      const sexMatch = entry.match(/^1\s+SEX\s+([MFXU])$/)
      if (sexMatch) {
        sex = sexMatch[1] as 'M' | 'F' | 'U' | 'X'
      }

      if (/^1\s+BIRT$/.test(entry)) {
        for (let j = i + 1; j < block.length; j += 1) {
          if (/^1\s+/.test(block[j])) break
          const dateMatch = block[j].match(/^2\s+DATE\s+(.+)$/)
          const placeMatch = block[j].match(/^2\s+PLAC\s+(.+)$/)
          if (dateMatch) birthDate = this.parseGedcomDate(dateMatch[1])
          if (placeMatch) birthPlace = placeMatch[1].trim()
        }
      }

      if (/^1\s+DEAT/.test(entry)) {
        for (let j = i + 1; j < block.length; j += 1) {
          if (/^1\s+/.test(block[j])) break
          const dateMatch = block[j].match(/^2\s+DATE\s+(.+)$/)
          const placeMatch = block[j].match(/^2\s+PLAC\s+(.+)$/)
          if (dateMatch) deathDate = this.parseGedcomDate(dateMatch[1])
          if (placeMatch) deathPlace = placeMatch[1].trim()
        }
      }

      const noteMatch = entry.match(/^1\s+NOTE\s+(.+)$/)
      if (noteMatch) {
        notes.push(noteMatch[1].trim())
      }
    }

    return {
      xref,
      firstName,
      lastName,
      fullName,
      nickname,
      sex,
      birthDate,
      birthPlace,
      deathDate,
      deathPlace,
      note: notes.length > 0 ? notes.join('\n') : null,
    }
  }

  private static parseFamily(xref: string, block: string[]): ParsedFamily {
    let husbandXref: string | null = null
    let wifeXref: string | null = null
    const childXrefs: string[] = []
    let marriageDate: Date | null = null
    let marriagePlace: string | null = null
    let divorceDate: Date | null = null

    for (let i = 0; i < block.length; i += 1) {
      const entry = block[i]
      const husbMatch = entry.match(/^1\s+HUSB\s+(@[^@]+@)$/)
      if (husbMatch) husbandXref = husbMatch[1]

      const wifeMatch = entry.match(/^1\s+WIFE\s+(@[^@]+@)$/)
      if (wifeMatch) wifeXref = wifeMatch[1]

      const childMatch = entry.match(/^1\s+CHIL\s+(@[^@]+@)$/)
      if (childMatch) childXrefs.push(childMatch[1])

      if (/^1\s+MARR$/.test(entry)) {
        for (let j = i + 1; j < block.length; j += 1) {
          if (/^1\s+/.test(block[j])) break
          const dateMatch = block[j].match(/^2\s+DATE\s+(.+)$/)
          const placeMatch = block[j].match(/^2\s+PLAC\s+(.+)$/)
          if (dateMatch) marriageDate = this.parseGedcomDate(dateMatch[1])
          if (placeMatch) marriagePlace = placeMatch[1].trim()
        }
      }

      if (/^1\s+DIV/.test(entry)) {
        for (let j = i + 1; j < block.length; j += 1) {
          if (/^1\s+/.test(block[j])) break
          const dateMatch = block[j].match(/^2\s+DATE\s+(.+)$/)
          if (dateMatch) divorceDate = this.parseGedcomDate(dateMatch[1])
        }
      }
    }

    return {
      xref,
      husbandXref,
      wifeXref,
      childXrefs,
      marriageDate,
      marriagePlace,
      divorceDate,
    }
  }

  private static parseGedcomDate(value: string | null | undefined): Date | null {
    if (!value) return null
    const input = value.trim().toUpperCase()
    const months: Record<string, number> = {
      JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
      JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
    }

    const dayMonthYear = input.match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{4})$/)
    if (dayMonthYear) {
      const day = Number(dayMonthYear[1])
      const month = months[dayMonthYear[2]]
      const year = Number(dayMonthYear[3])
      if (Number.isInteger(month)) return new Date(Date.UTC(year, month, day))
    }

    const monthYear = input.match(/^([A-Z]{3})\s+(\d{4})$/)
    if (monthYear) {
      const month = months[monthYear[1]]
      const year = Number(monthYear[2])
      if (Number.isInteger(month)) return new Date(Date.UTC(year, month, 1))
    }

    const yearOnly = input.match(/^(\d{4})$/)
    if (yearOnly) {
      return new Date(Date.UTC(Number(yearOnly[1]), 0, 1))
    }

    return null
  }

  private static parseNameValue(raw: string): { firstName: string; lastName: string | null; fullName: string } {
    const normalized = raw.trim()
    const match = normalized.match(/^(.*?)\s*\/(.*?)\//)

    if (match) {
      const firstName = match[1].trim() || 'Unknown'
      const lastName = match[2].trim() || null
      const fullName = [firstName, lastName].filter(Boolean).join(' ')
      return { firstName, lastName, fullName }
    }

    const parts = normalized.split(/\s+/).filter(Boolean)
    if (parts.length === 0) {
      return { firstName: 'Unknown', lastName: null, fullName: 'Unknown' }
    }

    if (parts.length === 1) {
      return { firstName: parts[0], lastName: null, fullName: parts[0] }
    }

    return {
      firstName: parts.slice(0, -1).join(' '),
      lastName: parts[parts.length - 1],
      fullName: parts.join(' '),
    }
  }
}
