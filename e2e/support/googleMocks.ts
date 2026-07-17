import type { BrowserContext, Page, Route } from '@playwright/test'
import { expect } from '@playwright/test'

export const TEST_SHEET_ID = 'test-sheet-1'
export const FRIEND_SHEET_ID = 'test-sheet-2'
export const TEST_USER = {
  email: 'test@example.com',
  name: 'Test User',
  picture: '',
  accessToken: 'fake-access-token',
  scopeVersion: 2,
}

const ROUTINE_HEADER = ['Program', 'Routine', 'Exercise', 'Sets', 'Reps', 'Value', 'Unit', 'Notes']
const LOG_HEADER = ['Date', 'Athlete', 'Program', 'Routine', 'Exercise', 'Set', 'Reps', 'Value', 'Unit', 'Notes', 'Pct']

type Row = (string | number)[]

export interface GoogleMockState {
  routineRows: Row[]
  logRows: Row[]
  appendedRows: Row[]
  appendsBySheet: Record<string, Row[]>
  failedAppendRows: Row[]
  routineWrites: Row[][]
  routineClears: string[]
  batchUpdates: unknown[]
  registryWrites: unknown[]
  failAppends: boolean
  unmatched: string[]
}

export function defaultRoutines(): Row[] {
  return [
    ['Strength', 'Day A', 'Squat', 3, 5, 225, 'lbs', ''],
    ['Strength', 'Day A', 'Bench Press', 3, 5, 135, 'lbs', 'pause reps'],
    ['Strength', 'Day B', 'Deadlift', 1, 5, 315, 'lbs', ''],
    ['Hypertrophy', 'Pump Day', 'Curl', 3, 12, 30, 'lbs', ''],
  ]
}

export function defaultLogs(): Row[] {
  return [
    ['2026-07-10', 'Test User', 'Strength', 'Day A', 'Squat', 1, 5, 215, 'lbs', '', ''],
    ['2026-07-10', 'Test User', 'Strength', 'Day A', 'Squat', 2, 5, 215, 'lbs', '', ''],
    ['2026-07-10', 'Test User', 'Strength', 'Day A', 'Bench Press', 1, 5, 130, 'lbs', '', ''],
  ]
}

/** Seed a logged-in user + cached registry ids so the app boots straight to the sheet selector. */
export async function seedAuth(context: BrowserContext, opts?: { scopeVersion?: number }) {
  const user = { ...TEST_USER, scopeVersion: opts?.scopeVersion ?? TEST_USER.scopeVersion }
  await context.addInitScript((user) => {
    localStorage.setItem('repsheets_user', JSON.stringify(user))
    localStorage.setItem('repsheets_token', user.accessToken)
    localStorage.setItem('repsheets_token_time', String(Date.now()))
    localStorage.setItem('repsheets_registry_id', 'reg-1')
    localStorage.setItem('repsheets_alias_id', 'alias-1')
    localStorage.setItem('repsheets_registry_migrated', '1')
    localStorage.setItem('repsheets_tour_done', '1')
    localStorage.setItem('repsheets_install_hint_dismissed', '1')
  }, user)
}

/** Boot the app and click through the sheet selector into the main app. */
export async function enterApp(page: Page) {
  await page.goto('/app.html')
  await expect(page.getByText('My Workouts')).toBeVisible({ timeout: 15_000 })
  await page.getByText('My Workouts').click()
  await expect(page.getByRole('heading', { name: 'Routines' })).toBeVisible({ timeout: 15_000 })
}

/** Stub the Google Identity Services script and Cloudflare beacon. */
export async function stubThirdPartyScripts(context: BrowserContext) {
  await context.route('https://accounts.google.com/**', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `window.__gis = { tokenClientCalls: 0, codeClientCalls: 0, requestCodeCalls: 0 };
      window.google = { accounts: { oauth2: {
        initTokenClient: function () { window.__gis.tokenClientCalls++; return { requestAccessToken: function () {} } },
        initCodeClient: function () { window.__gis.codeClientCalls++; return { requestCode: function () { window.__gis.requestCodeCalls++ } } },
        revoke: function (_t, cb) { if (cb) cb() },
      } } };`,
    })
  )
  await context.route('https://static.cloudflareinsights.com/**', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: '' })
  )
}

/** Intercept all Google Drive/Sheets API traffic with an in-memory fake backend. */
export async function mockGoogleApis(context: BrowserContext): Promise<GoogleMockState> {
  const state: GoogleMockState = {
    routineRows: defaultRoutines(),
    logRows: defaultLogs(),
    appendedRows: [],
    appendsBySheet: {},
    failedAppendRows: [],
    routineWrites: [],
    routineClears: [],
    batchUpdates: [],
    registryWrites: [],
    failAppends: false,
    unmatched: [],
  }

  const json = (body: unknown, status = 200) => ({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })

  const handler = async (route: Route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = decodeURIComponent(url.pathname)
    const method = req.method()

    if (path === '/oauth2/v3/userinfo') {
      return route.fulfill(json({ email: TEST_USER.email, name: TEST_USER.name, picture: '' }))
    }

    if (path === '/drive/v3/files' && method === 'GET') {
      const q = url.searchParams.get('q') ?? ''
      if (q.includes('repsheets.registry')) return route.fulfill(json({ files: [{ id: 'reg-1' }] }))
      if (q.includes('repsheets.alias')) return route.fulfill(json({ files: [{ id: 'alias-1' }] }))
      return route.fulfill(
        json({
          files: [
            {
              id: TEST_SHEET_ID,
              name: 'My Workouts',
              owners: [{ displayName: 'Test User', emailAddress: TEST_USER.email }],
            },
            {
              id: FRIEND_SHEET_ID,
              name: 'Friend Sheet',
              owners: [{ displayName: 'Friend User', emailAddress: 'friend@example.com' }],
            },
          ],
        })
      )
    }
    if (path === '/drive/v3/files' && method === 'POST') {
      return route.fulfill(json({ id: 'created-file-1' }))
    }

    if (path === '/drive/v3/files/reg-1' && url.searchParams.get('alt') === 'media') {
      return route.fulfill(json([]))
    }
    if (path === '/drive/v3/files/alias-1' && url.searchParams.get('alt') === 'media') {
      return route.fulfill(json({ alias: 'Test User' }))
    }

    if (path.startsWith('/drive/v3/files/') && method === 'GET') {
      const id = path.split('/')[4]
      const fields = url.searchParams.get('fields') ?? ''
      if (fields.includes('owners')) {
        return route.fulfill(json({ owners: [{ displayName: 'Test User', emailAddress: TEST_USER.email }] }))
      }
      return route.fulfill(json({ id, trashed: false }))
    }

    if (path.startsWith('/upload/drive/v3/files/') && method === 'PATCH') {
      state.registryWrites.push(req.postDataJSON())
      return route.fulfill(json({}))
    }

    const valuesMatch = path.match(/^\/v4\/spreadsheets\/([^/]+)\/values\/(.+)$/)
    if (valuesMatch) {
      const sheetId = valuesMatch[1]
      const range = valuesMatch[2]
      if (range.endsWith(':append')) {
        if (state.failAppends) {
          const failedBody = req.postDataJSON() as { values: Row[] }
          state.failedAppendRows.push(...failedBody.values)
          return route.fulfill(json({ error: { message: 'backend error' } }, 500))
        }
        const body = req.postDataJSON() as { values: Row[] }
        state.appendedRows.push(...body.values)
        ;(state.appendsBySheet[sheetId] ??= []).push(...body.values)
        state.logRows.push(...body.values)
        return route.fulfill(json({ updates: { updatedRows: body.values.length } }))
      }
      if (range.endsWith(':clear')) {
        state.routineClears.push(range)
        return route.fulfill(json({}))
      }
      if (method === 'PUT' && range.startsWith('Routines')) {
        // Whole-tab rewrite from the routine editor: body is [header, ...rows]
        const body = req.postDataJSON() as { values: Row[] }
        state.routineWrites.push(body.values)
        state.routineRows = body.values.slice(1)
        return route.fulfill(json({}))
      }
      if (range.startsWith('Routines')) {
        return route.fulfill(json({ values: [ROUTINE_HEADER, ...state.routineRows] }))
      }
      if (range.startsWith('Log')) {
        return route.fulfill(json({ values: [LOG_HEADER, ...state.logRows] }))
      }
      return route.fulfill(json({ values: [] }))
    }

    if (path.match(/^\/v4\/spreadsheets\/[^/]+\/values:batchUpdate$/)) {
      state.batchUpdates.push(req.postDataJSON())
      return route.fulfill(json({}))
    }

    if (path.match(/^\/v4\/spreadsheets\/[^/]+(:batchUpdate)?$/)) {
      if (method === 'POST' && path.endsWith(':batchUpdate')) {
        state.batchUpdates.push(req.postDataJSON())
        return route.fulfill(json({}))
      }
      return route.fulfill(
        json({
          properties: { title: 'My Workouts' },
          sheets: [
            { properties: { title: 'Routines', sheetId: 0 } },
            { properties: { title: 'Log', sheetId: 1 } },
          ],
        })
      )
    }

    state.unmatched.push(`${method} ${req.url()}`)
    return route.fulfill(json({}))
  }

  await context.route('https://www.googleapis.com/**', handler)
  await context.route('https://sheets.googleapis.com/**', handler)
  return state
}
