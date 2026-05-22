export interface ParsedEvent {
  eventType: string
  eventDate: Date | null
  rawDate: string | null
  place: string | null
  description: string | null
  customType: string | null
  causeOfDeath: string | null
  gedcomTag: string
  eventIndex: number
}

export interface ParsedNote {
  content: string
  noteType: 'GENERAL' | 'RESEARCH' | 'OBITUARY' | 'SOURCE' | 'OTHER'
}

export interface StandaloneNote {
  xref: string
  content: string
}

export interface StandaloneSource {
  xref: string
  title: string | null
  author: string | null
  date: string | null
  /** Full text content from SOUR TEXT subrecord, if present */
  text: string | null
}

export interface ParsedSourceCitation {
  gedcomSRef: string | null
  page: string | null
  text: string | null
  sourceTitle: string | null
  sourceAuthor: string | null
  sourceDate: string | null
}

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
  causeOfDeath: string | null
  isDeceased: boolean
  note: string | null
  notes: ParsedNote[]
  events: ParsedEvent[]
  sourceCitations: ParsedSourceCitation[]
  /** GEDCOM v7: EXID tag value, if present */
  externalId: string | null
  /** GEDCOM v7: FAMS xrefs (family-as-spouse cross-references) */
  familyAsSpouseXrefs: string[]
  /** GEDCOM v7: FAMC entries with optional pedigree type */
  familyAsChildLinks: Array<{ familyXref: string; pedigree: 'ADOPTED' | 'BIRTH' | 'FOSTER' | 'SEALING' | null }>
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

const TAG_TO_EVENT_TYPE: Record<string, string> = {
  BIRT: 'BIRTH',
  DEAT: 'DEATH',
  BURI: 'BURIAL',
  CREM: 'CREMATION',
  CHR: 'BAPTISM',
  BAPT: 'BAPTISM',
  CONF: 'BAPTISM',
  OCCU: 'OCCUPATION',
  RESI: 'RESIDENCE',
  IMMI: 'IMMIGRATION',
  EMIG: 'EMIGRATION',
  NATU: 'NATURALIZATION',
  CENS: 'CENSUS',
  RETI: 'RETIREMENT',
  WILL: 'WILL',
  TITL: 'TITLE',
  MILI: 'MILITARY_SERVICE',
  _MILT: 'MILITARY_SERVICE',
  ADOP: 'ADOPTION',
  EDUC: 'EDUCATION',
  GRAD: 'EDUCATION',
  DSCR: 'PHYSICAL_DESCRIPTION',
  EVEN: 'CUSTOM',
}

const INLINE_VALUE_TAGS = new Set(['OCCU', 'TITL', 'EVEN', 'DSCR'])

export class GedcomParser {
  private static sourceDefs = new Map<string, { title: string | null; author: string | null; date: string | null; text: string | null }>()
  private static noteDefs = new Map<string, string>()

  static parse(content: string): {
    individuals: ParsedIndividual[]
    families: ParsedFamily[]
    standaloneNotes: StandaloneNote[]
    standaloneSources: StandaloneSource[]
  } {
    const lines = content.split(/\r?\n/)
    this.sourceDefs.clear()
    this.noteDefs.clear()

    const standaloneNotes: StandaloneNote[] = []
    const standaloneSources: StandaloneSource[] = []

    // First pass: collect SOUR and NOTE record definitions
    let index = 0
    while (index < lines.length) {
      const line = lines[index].trim()

      // GEDCOM v7: silently skip SCHMA records
      if (/^0\s+SCHMA$/.test(line)) {
        index += 1
        while (index < lines.length && !/^0\s+/.test(lines[index].trim())) {
          index += 1
        }
        continue
      }

      const sourRecordMatch = line.match(/^0\s+(@[^@]+@)\s+SOUR$/)
      if (sourRecordMatch) {
        const sref = sourRecordMatch[1]
        const block: string[] = []
        index += 1
        while (index < lines.length && !/^0\s+/.test(lines[index].trim())) {
          block.push(lines[index].trim())
          index += 1
        }
        let title: string | null = null
        let author: string | null = null
        let date: string | null = null
        const textParts: string[] = []
        for (let bi = 0; bi < block.length; bi++) {
          const entry = block[bi]
          const m = entry.match(/^1\s+TITL\s+(.+)$/)
          if (m) title = m[1].trim()
          const a = entry.match(/^1\s+AUTH\s+(.+)$/)
          if (a) author = a[1].trim()
          const d = entry.match(/^1\s+DATE\s+(.+)$/)
          if (d) date = d[1].trim()
          const t = entry.match(/^1\s+TEXT\s*(.*)$/)
          if (t) {
            textParts.push(t[1])
            for (let ti = bi + 1; ti < block.length; ti++) {
              const tsub = block[ti]
              if (/^1\s+/.test(tsub)) break
              const cont = tsub.match(/^2\s+CONT\s*(.*)$/)
              const conc = tsub.match(/^2\s+CONC\s*(.*)$/)
              if (cont) textParts.push('\n' + cont[1])
              else if (conc) textParts.push(conc[1])
            }
          }
        }
        const text = textParts.length > 0 ? textParts.join('').trim() || null : null
        this.sourceDefs.set(sref, { title, author, date, text })
        standaloneSources.push({ xref: sref, title, author, date, text })
        continue
      }

      const noteRecordMatch = line.match(/^0\s+(@[^@]+@)\s+NOTE\s*(.*)$/)
      if (noteRecordMatch) {
        const nref = noteRecordMatch[1]
        const parts = [noteRecordMatch[2]]
        index += 1
        while (index < lines.length && !/^0\s+/.test(lines[index].trim())) {
          const sub = lines[index].trim()
          // GEDCOM v7: CONT with no trailing value (empty continuation line)
          const cont = sub.match(/^1\s+CONT(.*)$/)
          const conc = sub.match(/^1\s+CONC\s*(.*)$/)
          if (cont) parts.push('\n' + (cont[1].startsWith(' ') ? cont[1].slice(1) : cont[1]))
          else if (conc) parts.push(conc[1])
          index += 1
        }
        const noteContent = parts.join('').trim()
        this.noteDefs.set(nref, noteContent)
        standaloneNotes.push({ xref: nref, content: noteContent })
        continue
      }

      index += 1
    }

    // Second pass: parse INDI and FAM records
    const individuals: ParsedIndividual[] = []
    const families: ParsedFamily[] = []
    index = 0

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

    return { individuals, families, standaloneNotes, standaloneSources }
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
    let causeOfDeath: string | null = null
    let isDeceased = false
    let externalId: string | null = null
    const familyAsSpouseXrefs: string[] = []
    const familyAsChildLinks: Array<{ familyXref: string; pedigree: 'ADOPTED' | 'BIRTH' | 'FOSTER' | 'SEALING' | null }> = []
    const notes: ParsedNote[] = []
    const events: ParsedEvent[] = []
    const sourceCitations: ParsedSourceCitation[] = []
    const eventCounters: Record<string, number> = {}

    const EVENT_TAGS = new Set(Object.keys(TAG_TO_EVENT_TYPE))

    for (let i = 0; i < block.length; i += 1) {
      const entry = block[i]
      const levelMatch = entry.match(/^(\d+)\s+(\S+)/)
      if (!levelMatch) continue
      const entryLevel = parseInt(levelMatch[1])
      const tag = levelMatch[2]

      if (entryLevel !== 1) continue

      if (tag === 'NAME') {
        const nameMatch = entry.match(/^1\s+NAME\s+(.+)$/)
        if (nameMatch && fullName === 'Unknown') {
          const parsed = this.parseNameValue(nameMatch[1])
          firstName = parsed.firstName
          lastName = parsed.lastName
          fullName = parsed.fullName
        }
        // Check for NICK under NAME
        for (let j = i + 1; j < block.length; j++) {
          const sub = block[j]
          if (/^1\s+/.test(sub)) break
          const nickSub = sub.match(/^2\s+NICK\s+(.+)$/)
          if (nickSub && !nickname) nickname = nickSub[1].trim()
          // Collect SOUR citations under NAME
          const sourSub = sub.match(/^2\s+SOUR\s*(.*)$/)
          if (sourSub) {
            const citation = this.parseSourceCitation(block, j, 2)
            if (citation.text || citation.page) sourceCitations.push(citation)
          }
        }
        continue
      }

      if (tag === 'NICK') {
        const nickMatch = entry.match(/^1\s+NICK\s+(.+)$/)
        if (nickMatch && !nickname) nickname = nickMatch[1].trim()
        continue
      }

      if (tag === 'SEX') {
        const sexMatch = entry.match(/^1\s+SEX\s+([MFXU])$/)
        if (sexMatch) sex = sexMatch[1] as 'M' | 'F' | 'U' | 'X'
        continue
      }

      // GEDCOM v7: EXID — store as external reference identifier
      if (tag === 'EXID') {
        const exidMatch = entry.match(/^1\s+EXID\s+(.+)$/)
        if (exidMatch && !externalId) externalId = exidMatch[1].trim()
        continue
      }

      // GEDCOM v7: FAMS — family-as-spouse cross-reference
      if (tag === 'FAMS') {
        const famsMatch = entry.match(/^1\s+FAMS\s+(@[^@]+@)$/)
        if (famsMatch) familyAsSpouseXrefs.push(famsMatch[1])
        continue
      }

      // GEDCOM v7: FAMC — family-as-child with optional PEDI subrecord
      if (tag === 'FAMC') {
        const famcMatch = entry.match(/^1\s+FAMC\s+(@[^@]+@)$/)
        if (famcMatch) {
          const familyXref = famcMatch[1]
          let pedigree: 'ADOPTED' | 'BIRTH' | 'FOSTER' | 'SEALING' | null = null
          for (let j = i + 1; j < block.length; j++) {
            if (/^1\s+/.test(block[j])) break
            const pediMatch = block[j].match(/^2\s+PEDI\s+(\S+)$/)
            if (pediMatch) {
              const raw = pediMatch[1].toUpperCase()
              if (raw === 'ADOPTED' || raw === 'BIRTH' || raw === 'FOSTER' || raw === 'SEALING') {
                pedigree = raw
              }
            }
          }
          familyAsChildLinks.push({ familyXref, pedigree })
        }
        continue
      }

      // GEDCOM v7: NO — "no event occurred" marker; record as a RESEARCH note
      if (tag === 'NO') {
        const noMatch = entry.match(/^1\s+NO\s+(\S+)/)
        if (noMatch) {
          const eventTag = noMatch[1].trim()
          notes.push({
            content: `No ${eventTag} event recorded (GEDCOM NO tag)`,
            noteType: 'RESEARCH',
          })
        }
        continue
      }

      if (tag === 'NOTE') {
        const noteValMatch = entry.match(/^1\s+NOTE\s*(.*)$/)
        if (noteValMatch) {
          const val = noteValMatch[1].trim()
          let content: string

          if (/^@[^@]+@$/.test(val)) {
            content = this.noteDefs.get(val) ?? ''
          } else {
            const parts = [val]
            for (let j = i + 1; j < block.length; j++) {
              if (/^1\s+/.test(block[j])) break
              // GEDCOM v7: CONT may have no trailing space/value (empty continuation line)
              const cont = block[j].match(/^2\s+CONT(.*)$/)
              const conc = block[j].match(/^2\s+CONC\s*(.*)$/)
              if (cont) parts.push('\n' + (cont[1].startsWith(' ') ? cont[1].slice(1) : cont[1]))
              else if (conc) parts.push(conc[1])
            }
            content = parts.join('').trim()
          }

          if (content) {
            notes.push({ content, noteType: this.detectNoteType(content) })
          }
        }
        continue
      }

      if (tag === 'SOUR') {
        const citation = this.parseSourceCitation(block, i, 1)
        if (citation.text || citation.page) sourceCitations.push(citation)
        continue
      }

      if (EVENT_TAGS.has(tag)) {
        eventCounters[tag] = (eventCounters[tag] ?? 0) + 1
        const eventIndex = eventCounters[tag]
        const eventType = TAG_TO_EVENT_TYPE[tag]

        let eventDate: Date | null = null
        let rawDateStr: string | null = null
        let place: string | null = null
        let description: string | null = null
        let customType: string | null = null
        let caus: string | null = null

        // Value on same line for certain tags
        if (INLINE_VALUE_TAGS.has(tag)) {
          const inlineMatch = entry.match(/^1\s+\S+\s+(.+)$/)
          if (inlineMatch) description = inlineMatch[1].trim()
        }

        // Check for DEAT Y (deceased without date)
        if (tag === 'DEAT') {
          isDeceased = true
          const deatY = entry.match(/^1\s+DEAT\s+Y/)
          if (deatY) description = null
        }

        for (let j = i + 1; j < block.length; j++) {
          if (/^1\s+/.test(block[j])) break
          const sub = block[j]

          const dateMatch = sub.match(/^2\s+DATE\s+(.+)$/)
          if (dateMatch) {
            rawDateStr = dateMatch[1].trim()
            eventDate = this.parseGedcomDate(rawDateStr)
          }

          const placeMatch = sub.match(/^2\s+PLAC\s+(.+)$/)
          if (placeMatch) {
            // DSCR uses PLAC for the description text, not a geographic place
            if (tag === 'DSCR') {
              description = placeMatch[1].trim()
            } else {
              place = placeMatch[1].trim()
            }
          }

          const typeMatch = sub.match(/^2\s+TYPE\s+(.+)$/)
          if (typeMatch) customType = typeMatch[1].trim()

          const causMatch = sub.match(/^2\s+CAUS\s+(.+)$/)
          if (causMatch) caus = causMatch[1].trim()

          const descMatch = sub.match(/^2\s+(?:DESC)\s+(.+)$/)
          if (descMatch && !description) description = descMatch[1].trim()

          const subSourMatch = sub.match(/^2\s+SOUR\s*(.*)$/)
          if (subSourMatch) {
            const citation = this.parseSourceCitation(block, j, 2)
            if (citation.text || citation.page) sourceCitations.push(citation)
          }
        }

        if (tag === 'BIRT') {
          birthDate = eventDate
          birthPlace = place
        }
        if (tag === 'DEAT') {
          deathDate = eventDate
          deathPlace = place
          if (caus) causeOfDeath = caus
        }

        if (eventDate || place || description || customType || rawDateStr) {
          events.push({
            eventType,
            eventDate,
            rawDate: rawDateStr,
            place,
            description,
            customType,
            causeOfDeath: caus,
            gedcomTag: tag,
            eventIndex,
          })
        }
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
      causeOfDeath,
      isDeceased: isDeceased || Boolean(deathDate),
      note: notes.length > 0 ? notes.map((n) => n.content).join('\n') : null,
      notes,
      events,
      sourceCitations,
      externalId,
      familyAsSpouseXrefs,
      familyAsChildLinks,
    }
  }

  private static parseSourceCitation(block: string[], startIndex: number, sourLevel: number): ParsedSourceCitation {
    const entry = block[startIndex]
    const srefMatch = entry.match(new RegExp(`^${sourLevel}\\s+SOUR\\s+(@[^@]+@)`))
    const gedcomSRef = srefMatch ? srefMatch[1] : null
    const sourceDef = gedcomSRef ? (this.sourceDefs.get(gedcomSRef) ?? null) : null
    let page: string | null = null
    const textParts: string[] = []

    const textLevel = sourLevel + 2
    const contLevel = sourLevel + 3

    for (let j = startIndex + 1; j < block.length; j++) {
      const sub = block[j]
      const subLevelMatch = sub.match(/^(\d+)/)
      if (!subLevelMatch || parseInt(subLevelMatch[1]) <= sourLevel) break

      const pageMatch = sub.match(new RegExp(`^${sourLevel + 1}\\s+PAGE\\s+(.+)$`))
      if (pageMatch) { page = pageMatch[1].trim(); continue }

      const textMatch = sub.match(new RegExp(`^${textLevel}\\s+TEXT\\s*(.*)$`))
      if (textMatch) {
        textParts.push(textMatch[1])
        for (let k = j + 1; k < block.length; k++) {
          const ksub = block[k]
          const klevel = parseInt(ksub.match(/^(\d+)/)?.[1] ?? '0')
          if (klevel <= textLevel) break
          const cont = ksub.match(new RegExp(`^${contLevel}\\s+CONT\\s*(.*)$`))
          const conc = ksub.match(new RegExp(`^${contLevel}\\s+CONC\\s*(.*)$`))
          if (cont) textParts.push('\n' + cont[1])
          else if (conc) textParts.push(conc[1])
        }
      }
    }

    return {
      gedcomSRef,
      page,
      text: textParts.length > 0 ? textParts.join('').trim() || null : null,
      sourceTitle: sourceDef?.title ?? null,
      sourceAuthor: sourceDef?.author ?? null,
      sourceDate: sourceDef?.date ?? null,
    }
  }

  private static detectNoteType(content: string): 'GENERAL' | 'RESEARCH' | 'OBITUARY' | 'SOURCE' | 'OTHER' {
    const lower = content.toLowerCase()
    if (
      lower.includes('obituary') ||
      lower.includes('obit') ||
      lower.includes('survived by') ||
      lower.includes('passed away') ||
      lower.includes('funeral services') ||
      lower.includes('interment')
    ) {
      return 'OBITUARY'
    }
    if (
      lower.includes('research') ||
      lower.includes('source:') ||
      lower.includes('census') ||
      lower.includes('ancestry.com') ||
      lower.includes('find-a-grave') ||
      lower.includes('findagrave')
    ) {
      return 'RESEARCH'
    }
    return 'GENERAL'
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

    return { xref, husbandXref, wifeXref, childXrefs, marriageDate, marriagePlace, divorceDate }
  }

  static parseGedcomDate(value: string | null | undefined): Date | null {
    if (!value) return null
    // Strip modifiers: ABT, BEF, AFT, EST, CAL, FROM, TO, INT
    // For BET...AND, take the first date
    const stripped = value
      .trim()
      .toUpperCase()
      .replace(/^(ABT|BEF|AFT|EST|CAL|FROM|INT|TO|ABOUT|BEFORE|AFTER)\s+/, '')
      .replace(/^BET\s+/i, '')
      .replace(/\s+AND\s+.*$/, '')
      .trim()

    const months: Record<string, number> = {
      JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
      JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
    }

    const dayMonthYear = stripped.match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{4})$/)
    if (dayMonthYear) {
      const day = Number(dayMonthYear[1])
      const month = months[dayMonthYear[2]]
      const year = Number(dayMonthYear[3])
      if (Number.isInteger(month)) return new Date(Date.UTC(year, month, day))
    }

    const monthYear = stripped.match(/^([A-Z]{3})\s+(\d{4})$/)
    if (monthYear) {
      const month = months[monthYear[1]]
      const year = Number(monthYear[2])
      if (Number.isInteger(month)) return new Date(Date.UTC(year, month, 1))
    }

    const yearOnly = stripped.match(/^(\d{4})$/)
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
    if (parts.length === 0) return { firstName: 'Unknown', lastName: null, fullName: 'Unknown' }
    if (parts.length === 1) return { firstName: parts[0], lastName: null, fullName: parts[0] }

    return {
      firstName: parts.slice(0, -1).join(' '),
      lastName: parts[parts.length - 1],
      fullName: parts.join(' '),
    }
  }
}
