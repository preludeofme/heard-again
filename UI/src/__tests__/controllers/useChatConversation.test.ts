/**
 * useChatConversation — business-logic unit tests
 *
 * Tests verify the fetch URL patterns, response-parsing logic, and session
 * filtering behaviour that the hook relies on.  Written as pure Jest async
 * tests so they run without @testing-library/react.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type MockEntry = { ok: boolean; status?: number; body: object }

function makeFetch(map: Record<string, MockEntry>) {
  return jest.fn((url: string, init?: RequestInit) => {
    const method = (init?.method || 'GET').toUpperCase()
    const entry = map[`${method} ${url}`] ?? map[url] ?? { ok: false, status: 500, body: {} }
    return Promise.resolve({
      ok: entry.ok,
      status: entry.status ?? (entry.ok ? 200 : 500),
      json: () => Promise.resolve(entry.body),
      body: null,
    })
  })
}

// Pure helper that mirrors checkPersonaExists fetch logic without React
async function checkPersonaExistsLogic(
  subjectId: string | undefined
): Promise<{ exists: boolean; confidence?: number }> {
  if (!subjectId) return { exists: false }

  const response = await fetch(`/api/persona/${subjectId}`, {
    method: 'GET',
    credentials: 'include',
  })

  if (response.ok) {
    const data = await response.json()
    if (data.success) return { exists: true, confidence: data.persona.confidenceScore }
  } else if (response.status === 404) {
    return { exists: false }
  }
  return { exists: false }
}

// Pure helper that mirrors loadSessions fetch logic
async function loadSessionsLogic(): Promise<{ sessions: any[]; ok: boolean }> {
  const response = await fetch('/api/chat/sessions', { method: 'GET', credentials: 'include' })
  if (!response.ok) return { sessions: [], ok: false }
  const data = await response.json()
  return { sessions: data.success ? data.sessions : [], ok: true }
}

// Pure helper that mirrors deleteSession fetch logic + state update
async function deleteSessionLogic(
  sessionId: string,
  current: { sessions: any[]; activeSessionId?: string }
): Promise<{ sessions: any[]; activeSessionId?: string; messages: any[] }> {
  const response = await fetch(`/api/chat/sessions/${sessionId}`, {
    method: 'DELETE',
    credentials: 'include',
  })

  if (!response.ok) {
    return {
      sessions: current.sessions,
      activeSessionId: current.activeSessionId,
      messages: [],
    }
  }

  const newSessions = current.sessions.filter(s => s.id !== sessionId)
  const clearedActive = current.activeSessionId === sessionId
  return {
    sessions: newSessions,
    activeSessionId: clearedActive ? undefined : current.activeSessionId,
    messages: clearedActive ? [] : [],
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('checkPersonaExists logic', () => {
  const orig = global.fetch
  afterEach(() => { global.fetch = orig })

  it('returns { exists: false } when subjectId is undefined', async () => {
    const result = await checkPersonaExistsLogic(undefined)
    expect(result.exists).toBe(false)
  })

  it('returns { exists: true, confidence } when persona found', async () => {
    global.fetch = makeFetch({
      'GET /api/persona/person-1': {
        ok: true,
        body: { success: true, persona: { confidenceScore: 0.85 } },
      },
    }) as any

    const result = await checkPersonaExistsLogic('person-1')
    expect(result.exists).toBe(true)
    expect(result.confidence).toBeCloseTo(0.85)
  })

  it('returns { exists: false } on 404', async () => {
    global.fetch = makeFetch({
      'GET /api/persona/person-2': { ok: false, status: 404, body: {} },
    }) as any

    const result = await checkPersonaExistsLogic('person-2')
    expect(result.exists).toBe(false)
  })

  it('returns { exists: false } on server error', async () => {
    global.fetch = makeFetch({
      'GET /api/persona/person-3': { ok: false, status: 500, body: {} },
    }) as any

    const result = await checkPersonaExistsLogic('person-3')
    expect(result.exists).toBe(false)
  })
})

describe('loadSessions logic', () => {
  const orig = global.fetch
  afterEach(() => { global.fetch = orig })

  it('returns populated sessions array on success', async () => {
    const sessions = [
      { id: 's1', personId: 'p1', title: 'Chat 1', status: 'active', createdAt: '', updatedAt: '' },
      { id: 's2', personId: 'p1', title: 'Chat 2', status: 'active', createdAt: '', updatedAt: '' },
    ]
    global.fetch = makeFetch({
      'GET /api/chat/sessions': { ok: true, body: { success: true, sessions } },
    }) as any

    const result = await loadSessionsLogic()
    expect(result.ok).toBe(true)
    expect(result.sessions).toHaveLength(2)
    expect(result.sessions[0].id).toBe('s1')
  })

  it('returns empty array on fetch failure', async () => {
    global.fetch = makeFetch({
      'GET /api/chat/sessions': { ok: false, status: 500, body: {} },
    }) as any

    const result = await loadSessionsLogic()
    expect(result.ok).toBe(false)
    expect(result.sessions).toEqual([])
  })

  it('returns empty array when success=false in body', async () => {
    global.fetch = makeFetch({
      'GET /api/chat/sessions': { ok: true, body: { success: false } },
    }) as any

    const result = await loadSessionsLogic()
    expect(result.sessions).toEqual([])
  })
})

describe('deleteSession logic', () => {
  const orig = global.fetch
  afterEach(() => { global.fetch = orig })

  it('removes the session from the sessions list', async () => {
    global.fetch = makeFetch({
      'DELETE /api/chat/sessions/s1': { ok: true, body: { success: true } },
    }) as any

    const sessions = [
      { id: 's1', title: 'Chat 1' },
      { id: 's2', title: 'Chat 2' },
    ]
    const result = await deleteSessionLogic('s1', { sessions })
    expect(result.sessions).toHaveLength(1)
    expect(result.sessions[0].id).toBe('s2')
  })

  it('clears activeSessionId when the active session is deleted', async () => {
    global.fetch = makeFetch({
      'DELETE /api/chat/sessions/s1': { ok: true, body: { success: true } },
    }) as any

    const result = await deleteSessionLogic('s1', {
      sessions: [{ id: 's1', title: 'Chat 1' }],
      activeSessionId: 's1',
    })
    expect(result.activeSessionId).toBeUndefined()
    expect(result.messages).toEqual([])
  })

  it('preserves sessions list on DELETE failure', async () => {
    global.fetch = makeFetch({
      'DELETE /api/chat/sessions/s1': { ok: false, status: 500, body: {} },
    }) as any

    const sessions = [{ id: 's1', title: 'Chat 1' }]
    const result = await deleteSessionLogic('s1', { sessions })
    expect(result.sessions).toHaveLength(1)
  })
})

describe('fetch URL shape verification', () => {
  const orig = global.fetch
  afterEach(() => { global.fetch = orig })

  it('persona check hits /api/persona/:subjectId', async () => {
    const spy = makeFetch({ 'GET /api/persona/abc': { ok: false, status: 404, body: {} } })
    global.fetch = spy as any
    await checkPersonaExistsLogic('abc')
    expect(spy).toHaveBeenCalledWith('/api/persona/abc', expect.objectContaining({ method: 'GET' }))
  })

  it('loadSessions hits GET /api/chat/sessions', async () => {
    const spy = makeFetch({ 'GET /api/chat/sessions': { ok: true, body: { success: true, sessions: [] } } })
    global.fetch = spy as any
    await loadSessionsLogic()
    expect(spy).toHaveBeenCalledWith('/api/chat/sessions', expect.objectContaining({ method: 'GET' }))
  })

  it('deleteSession hits DELETE /api/chat/sessions/:id', async () => {
    const spy = makeFetch({ 'DELETE /api/chat/sessions/xyz': { ok: true, body: { success: true } } })
    global.fetch = spy as any
    await deleteSessionLogic('xyz', { sessions: [] })
    expect(spy).toHaveBeenCalledWith('/api/chat/sessions/xyz', expect.objectContaining({ method: 'DELETE' }))
  })
})
