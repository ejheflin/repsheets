import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readExerciseSettings } from '../sheets/driveApi'

describe('registry duplicate merge (get-or-create race)', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(
      'repsheets_user',
      JSON.stringify({ email: 'a@b.c', name: 'A', picture: '', accessToken: 'token' })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('converges on the oldest file, merges entries, and deletes duplicates', async () => {
    const calls: Array<{ method: string; url: string; body?: unknown }> = []
    vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = String(url)
      calls.push({ method: init?.method ?? 'GET', url: u, body: init?.body ? JSON.parse(init.body as string) : undefined })
      if (u.includes('spaces=appDataFolder')) {
        return new Response(JSON.stringify({ files: [{ id: 'reg-old' }, { id: 'reg-new' }] }))
      }
      if (u.includes('/files/reg-old?alt=media')) {
        return new Response(JSON.stringify([{ id: 'sheetA', name: 'A', owner: 'O', ownerEmail: 'o@x', exerciseSettings: { Squat: { oneRepMax: 300 } } }]))
      }
      if (u.includes('/files/reg-new?alt=media')) {
        return new Response(JSON.stringify([{ id: 'sheetB', name: 'B', owner: 'O', ownerEmail: 'o@x' }]))
      }
      return new Response('{}')
    }))

    const settings = await readExerciseSettings('sheetA')
    expect(settings).toEqual({ Squat: { oneRepMax: 300 } })

    // search must request oldest-first ordering
    const search = calls.find((c) => c.url.includes('spaces=appDataFolder'))
    expect(search?.url).toContain('orderBy=createdTime')

    // merged content (both sheets) written to the oldest file
    const patch = calls.find((c) => c.method === 'PATCH' && c.url.includes('/reg-old'))
    expect(patch).toBeDefined()
    expect((patch!.body as Array<{ id: string }>).map((e) => e.id).sort()).toEqual(['sheetA', 'sheetB'])

    // duplicate deleted, primary cached
    expect(calls.some((c) => c.method === 'DELETE' && c.url.includes('/files/reg-new'))).toBe(true)
    expect(localStorage.getItem('repsheets_registry_id')).toBe('reg-old')
  })

  it('does not delete duplicates when a read fails', async () => {
    const calls: Array<{ method: string; url: string }> = []
    vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = String(url)
      calls.push({ method: init?.method ?? 'GET', url: u })
      if (u.includes('spaces=appDataFolder')) {
        return new Response(JSON.stringify({ files: [{ id: 'reg-old' }, { id: 'reg-new' }] }))
      }
      if (u.includes('/files/reg-old?alt=media')) {
        return new Response(JSON.stringify([]))
      }
      if (u.includes('/files/reg-new?alt=media')) {
        return new Response('server error', { status: 500 })
      }
      return new Response('{}')
    }))

    await readExerciseSettings('sheetA')
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false)
  })
})
