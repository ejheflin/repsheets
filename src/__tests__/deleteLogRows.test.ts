import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { deleteLogRows } from '../sheets/sheetsApi'

describe('deleteLogRows', () => {
  beforeEach(() => {
    localStorage.setItem(
      'repsheets_user',
      JSON.stringify({ email: 'a@b.c', name: 'A', picture: '', accessToken: 'token' })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('deletes bottom-up with deduped, 0-based single-row ranges on the Log tab', async () => {
    const calls: Array<{ url: string; body?: unknown }> = []
    vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), body: init?.body ? JSON.parse(init.body as string) : undefined })
      if (String(url).includes('fields=sheets.properties')) {
        return new Response(JSON.stringify({
          sheets: [
            { properties: { title: 'Routines', sheetId: 111 } },
            { properties: { title: 'Log', sheetId: 222 } },
          ],
        }))
      }
      return new Response('{}')
    }))

    await deleteLogRows('sheet-x', [3, 7, 3])

    expect(calls.length).toBe(2)
    expect(calls[1].url).toContain(':batchUpdate')
    expect(calls[1].body).toEqual({
      requests: [
        { deleteDimension: { range: { sheetId: 222, dimension: 'ROWS', startIndex: 6, endIndex: 7 } } },
        { deleteDimension: { range: { sheetId: 222, dimension: 'ROWS', startIndex: 2, endIndex: 3 } } },
      ],
    })
  })

  it('does nothing for an empty index list', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    await deleteLogRows('sheet-x', [])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('throws if the Log tab is missing instead of deleting from the wrong tab', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ sheets: [{ properties: { title: 'Routines', sheetId: 111 } }] }))
    ))
    await expect(deleteLogRows('sheet-x', [2])).rejects.toThrow('Log tab not found')
  })
})
