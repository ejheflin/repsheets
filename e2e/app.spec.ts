import { test, expect } from '@playwright/test'
import {
  seedAuth,
  stubThirdPartyScripts,
  mockGoogleApis,
  enterApp,
  TEST_SHEET_ID,
  FRIEND_SHEET_ID,
  type GoogleMockState,
} from './support/googleMocks'

test.describe('oauth redirect state validation', () => {
  const WORKER_URL = 'https://repsheets-auth.repsheets.workers.dev'
  let tokenCalls: number

  test.beforeEach(async ({ context }) => {
    await stubThirdPartyScripts(context)
    await mockGoogleApis(context)
    tokenCalls = 0
    await context.route(`${WORKER_URL}/**`, (route) => {
      tokenCalls++
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ access_token: 'fresh-token', refresh_token: 'fresh-refresh' }),
      })
    })
  })

  test('rejects a redirect code with forged/missing state (login CSRF)', async ({ page }) => {
    await page.goto('/app.html?code=attacker-code&state=forged')
    await page.waitForTimeout(1500)
    expect(tokenCalls).toBe(0)
    expect(await page.evaluate(() => localStorage.getItem('repsheets_user'))).toBeNull()
  })

  test('accepts a redirect code with matching state and logs in', async ({ context, page }) => {
    await context.addInitScript(() => {
      sessionStorage.setItem('repsheets_oauth_state', 'nonce-abc123')
    })
    await page.goto('/app.html?code=good-code&state=nonce-abc123')
    await expect(page.getByText('Welcome to repsheets')).toBeVisible()
    expect(tokenCalls).toBe(1)
    // state param must be scrubbed from the URL and the nonce consumed
    expect(new URL(page.url()).searchParams.get('state')).toBeNull()
    expect(await page.evaluate(() => sessionStorage.getItem('repsheets_oauth_state'))).toBeNull()
  })
})

test.describe('scope upgrade', () => {
  test.beforeEach(async ({ context }) => {
    await stubThirdPartyScripts(context)
    await mockGoogleApis(context)
  })

  test('stale scope version triggers code-flow re-consent, once per session', async ({ context, page }) => {
    await seedAuth(context, { scopeVersion: 1 })
    await page.goto('/app.html')

    // must go through the code client (re-mints the refresh token), not the
    // implicit token client (whose refresh would silently revert scopes)
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __gis: { requestCodeCalls: number } }).__gis.requestCodeCalls))
      .toBeGreaterThan(0)

    // guard is set so a canceled consent doesn't redirect-loop every reload
    expect(await page.evaluate(() => sessionStorage.getItem('repsheets_scope_upgrade_attempted'))).toBe('2')
    await page.reload()
    await page.waitForTimeout(1000)
    expect(await page.evaluate(() => (window as unknown as { __gis: { requestCodeCalls: number } }).__gis.requestCodeCalls)).toBe(0)
  })

  test('current scope version does not trigger any upgrade', async ({ context, page }) => {
    await seedAuth(context)
    await page.goto('/app.html')
    await expect(page.getByText('Welcome to repsheets')).toBeVisible()
    const gis = await page.evaluate(() => (window as unknown as { __gis: { requestCodeCalls: number; tokenClientCalls: number } }).__gis)
    expect(gis.requestCodeCalls).toBe(0)
  })
})

test.describe('authenticated app (mocked Google APIs)', () => {
  let state: GoogleMockState

  test.beforeEach(async ({ context }) => {
    await stubThirdPartyScripts(context)
    state = await mockGoogleApis(context)
    await seedAuth(context)
  })

  test('sheet selector lists sheets and selecting one loads routines', async ({ page }) => {
    await page.goto('/app.html')
    await expect(page.getByText('Welcome to repsheets')).toBeVisible()
    await expect(page.getByText('My Workouts')).toBeVisible()

    await page.getByText('My Workouts').click()
    await expect(page.getByRole('heading', { name: 'Routines' })).toBeVisible()
    await expect(page.getByText('Day A', { exact: true })).toBeVisible()
    await expect(page.getByText('Day B', { exact: true })).toBeVisible()
  })

  test('program selector switches programs', async ({ page }) => {
    await enterApp(page)
    await expect(page.getByText('Day A', { exact: true })).toBeVisible()

    await page.locator('select').selectOption('Hypertrophy')
    await expect(page.getByText('Pump Day')).toBeVisible()
    await expect(page.getByText('Day A', { exact: true })).not.toBeVisible()
  })

  test('full workout: start, finish, rows appended to sheet', async ({ page }) => {
    await enterApp(page)

    await page.getByText('Day A', { exact: true }).click()
    await expect(page.getByText('Squat')).toBeVisible()
    await expect(page.getByText('Bench Press')).toBeVisible()

    await page.getByRole('button', { name: 'Finish' }).click()
    // Unchecked sets -> confirmation sheet offers to complete everything
    const completeAll = page.getByRole('button', { name: /complete all|log all/i })
    if (await completeAll.isVisible().catch(() => false)) {
      await completeAll.click()
    }

    await expect
      .poll(() => state.appendedRows.length, { timeout: 10_000 })
      .toBeGreaterThan(0)

    const rows = state.appendedRows
    expect(rows.length).toBe(6) // Squat 3x5 + Bench 3x5
    for (const row of rows) {
      expect(row[2]).toBe('Strength')
      expect(row[3]).toBe('Day A')
      expect(String(row[0])).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
    expect(new Set(rows.map((r) => r[4]))).toEqual(new Set(['Squat', 'Bench Press']))
  })

  test('logs tab shows history from the sheet', async ({ page }) => {
    await enterApp(page)
    await page.getByRole('button', { name: 'Logs' }).click()
    await expect(page.getByRole('heading', { name: 'Logs' })).toBeVisible()
  })

  test('finishing after a sheet switch still logs to the original sheet', async ({ page }) => {
    await enterApp(page)

    // start a workout on My Workouts (test-sheet-1)
    await page.getByText('Day A', { exact: true }).click()
    await expect(page.getByText('Squat')).toBeVisible()

    // switch to the friend's sheet mid-workout
    await page.getByRole('button', { name: 'Routines' }).click()
    await page.locator('[data-tour="sheet-switcher"]').click()
    await page.getByText('Friend Sheet').click()

    // the workout is still in progress; finish it
    await page.getByRole('button', { name: 'Workout' }).click()
    await expect(page.getByRole('heading', { name: 'Day A' })).toBeVisible()
    await page.getByRole('button', { name: 'Finish' }).click()
    const completeAll = page.getByRole('button', { name: /complete all|log all/i })
    if (await completeAll.isVisible().catch(() => false)) {
      await completeAll.click()
    }

    await expect.poll(() => state.appendedRows.length, { timeout: 10_000 }).toBe(6)
    // every row must land on the sheet the workout was started on
    expect(state.appendsBySheet[TEST_SHEET_ID]?.length ?? 0).toBe(6)
    expect(state.appendsBySheet[FRIEND_SHEET_ID] ?? []).toEqual([])
  })

  test('decimal weights can be typed and land in the sheet unrounded', async ({ page }) => {
    await enterApp(page)

    await page.getByText('Day A', { exact: true }).click()
    await expect(page.getByText('Squat')).toBeVisible()

    // type a fractional weight into Squat's summary weight input
    const weightInput = page.locator('input[inputmode="decimal"]').first()
    await weightInput.fill('232.5')
    await expect(weightInput).toHaveValue('232.5')

    await page.getByRole('button', { name: 'Finish' }).click()
    const completeAll = page.getByRole('button', { name: /complete all|log all/i })
    if (await completeAll.isVisible().catch(() => false)) {
      await completeAll.click()
    }

    await expect.poll(() => state.appendedRows.length, { timeout: 10_000 }).toBe(6)
    const squatRows = state.appendedRows.filter((r) => r[4] === 'Squat')
    expect(squatRows.length).toBe(3)
    for (const r of squatRows) {
      expect(r[7]).toBe(232.5)
    }
  })

  test('typed-but-unchecked values survive an app reload', async ({ page }) => {
    await enterApp(page)

    await page.getByText('Day A', { exact: true }).click()
    await expect(page.getByText('Squat')).toBeVisible()

    // type a weight without checking the set off
    const weightInput = page.locator('input[inputmode="decimal"]').first()
    await weightInput.fill('232.5')
    await expect(weightInput).toHaveValue('232.5')

    // reload — the restored workout gets refreshed from the sheet, which
    // must NOT overwrite the typed value with the autofilled 215
    await page.reload()
    await page.getByRole('button', { name: 'Workout' }).click()
    await expect(page.getByRole('heading', { name: 'Day A' })).toBeVisible()
    await page.waitForTimeout(1500)
    await expect(page.locator('input[inputmode="decimal"]').first()).toHaveValue('232.5')
  })

  test('adding a set then confirming Update Routine writes the new set count', async ({ page }) => {
    await enterApp(page)

    await page.getByText('Day A', { exact: true }).click()
    await expect(page.getByText('Squat')).toBeVisible()

    // expand the first exercise (Squat) and add a 4th set
    await page.getByText('3×').first().click()
    await page.getByRole('button', { name: '+ Add Set' }).click()

    await page.getByRole('button', { name: 'Finish' }).click()
    const completeAll = page.getByRole('button', { name: /complete all|log all/i })
    if (await completeAll.isVisible().catch(() => false)) {
      await completeAll.click()
    }

    await expect(page.getByText('Update Routine?')).toBeVisible()
    await page.getByRole('button', { name: 'Update Routine', exact: true }).click()

    await expect.poll(() => state.batchUpdates.length, { timeout: 10_000 }).toBeGreaterThan(0)
    const update = state.batchUpdates[0] as {
      valueInputOption: string
      data: Array<{ range: string; values: string[][] }>
    }
    // Squat is the first data row of the Routines tab -> sheet row 2, sets column D
    expect(update.data).toEqual([{ range: 'Routines!D2', values: [['4']] }])
    await expect(page.getByText('Routine updated')).toBeVisible()

    // 4 Squat sets + 3 Bench sets were logged
    expect(state.appendedRows.length).toBe(7)
  })

  test('failed append queues entries and flushes exactly once later', async ({ page }) => {
    await enterApp(page)

    state.failAppends = true
    await page.getByText('Day A', { exact: true }).click()
    await expect(page.getByText('Squat')).toBeVisible()

    await page.getByRole('button', { name: 'Finish' }).click()
    const completeAll = page.getByRole('button', { name: /complete all|log all/i })
    if (await completeAll.isVisible().catch(() => false)) {
      await completeAll.click()
    }

    // append 500s -> nothing lands in the sheet, entries queue locally
    await page.waitForTimeout(1000)
    expect(state.appendedRows.length).toBe(0)

    // next app load flushes the queue exactly once
    state.failAppends = false
    await page.reload()
    await expect.poll(() => state.appendedRows.length, { timeout: 10_000 }).toBe(6)

    // a further reload must not re-append (rows are marked synced)
    await page.reload()
    await expect(page.getByRole('button', { name: 'Routines' })).toBeVisible()
    await page.waitForTimeout(1500)
    expect(state.appendedRows.length).toBe(6)
  })

  test('queued sets that already committed server-side are not re-appended', async ({ page }) => {
    await enterApp(page)

    state.failAppends = true
    await page.getByText('Day A', { exact: true }).click()
    await expect(page.getByText('Squat')).toBeVisible()
    await page.getByRole('button', { name: 'Finish' }).click()
    const completeAll = page.getByRole('button', { name: /complete all|log all/i })
    if (await completeAll.isVisible().catch(() => false)) {
      await completeAll.click()
    }

    // the append "failed" from the client's view, entries were queued
    await expect.poll(() => state.failedAppendRows.length, { timeout: 10_000 }).toBe(6)
    expect(state.appendedRows.length).toBe(0)

    // simulate the append having actually committed server-side (response lost)
    state.logRows.push(...state.failedAppendRows)
    state.failAppends = false

    // next load flushes the queue — read-back must detect the rows and skip them
    await page.reload()
    await expect(page.getByRole('button', { name: 'Routines' })).toBeVisible()
    await page.waitForTimeout(2000)
    expect(state.appendedRows.length).toBe(0)

    // queue was drained (marked synced), not just deferred
    await page.reload()
    await expect(page.getByRole('button', { name: 'Routines' })).toBeVisible()
    await page.waitForTimeout(1500)
    expect(state.appendedRows.length).toBe(0)
  })

  test('no unmatched Google API calls and no page errors while navigating', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(String(e)))

    await enterApp(page)
    await page.getByRole('button', { name: 'Logs' }).click()
    await expect(page.getByRole('heading', { name: 'Logs' })).toBeVisible()
    await page.getByRole('button', { name: 'Workout' }).click()
    await page.waitForTimeout(500)

    expect(errors).toEqual([])
    expect(state.unmatched).toEqual([])
  })
})
