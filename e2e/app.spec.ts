import { test, expect, type Page } from '@playwright/test'

// Tapping a routine card opens the routine editor; workouts start from its
// Start button
async function startWorkout(page: Page, routine: string) {
  await page.getByText(routine, { exact: true }).click()
  await page.getByRole('button', { name: 'Start' }).first().click()
}

// SwipeableRow listens to raw touch events; synthesize a leftward swipe
async function swipeLeft(locator: ReturnType<Page['locator']>) {
  await locator.evaluate((el) => {
    const rect = el.getBoundingClientRect()
    const startX = rect.left + rect.width * 0.8
    const y = rect.top + rect.height / 2
    const fire = (type: string, x: number) => {
      const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: y })
      el.dispatchEvent(new TouchEvent(type, {
        touches: type === 'touchend' ? [] : [t],
        changedTouches: [t],
        bubbles: true,
        cancelable: true,
      }))
    }
    fire('touchstart', startX)
    for (let i = 1; i <= 6; i++) fire('touchmove', startX - i * 20)
    fire('touchend', startX - 120)
  })
}
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

test.describe('routine editor (mocked Google APIs)', () => {
  let state: GoogleMockState

  test.beforeEach(async ({ context }) => {
    await stubThirdPartyScripts(context)
    state = await mockGoogleApis(context)
    await seedAuth(context)
  })

  test('bumping a set count autosaves and preserves every other row', async ({ page }) => {
    await enterApp(page)
    await page.getByText('Day A', { exact: true }).click()

    // first stepper "+" in the expanded card is Squat's set count
    await page.getByRole('button', { name: '+', exact: true }).first().click()

    await expect.poll(() => state.routineWrites.length, { timeout: 10_000 }).toBeGreaterThan(0)
    const written = state.routineWrites[state.routineWrites.length - 1]
    const rows = written.slice(1).map((r) => r.map(String))

    const squat = rows.find((r) => r[1] === 'Day A' && r[2] === 'Squat')
    expect(squat?.[3]).toBe('4')

    // the whole-tab rewrite must not drop unrelated routines or programs
    expect(rows.some((r) => r[1] === 'Day B' && r[2] === 'Deadlift')).toBe(true)
    expect(rows.some((r) => r[0] === 'Hypertrophy' && r[2] === 'Curl')).toBe(true)
    expect(rows.some((r) => r[1] === 'Day A' && r[2] === 'Bench Press')).toBe(true)
  })

  test('editing a routine never touches a same-named routine in another program', async ({ page }) => {
    // 'Day A' exists in BOTH programs — the duplication bug merged them into
    // one editor card and saved both programs' exercises under Strength
    state.routineRows.push(['Hypertrophy', 'Day A', 'Lunge', 3, 12, 40, 'lbs', ''])

    await enterApp(page)
    await page.getByText('Day A', { exact: true }).click()
    await page.getByRole('button', { name: '+', exact: true }).first().click()

    await expect.poll(() => state.routineWrites.length, { timeout: 10_000 }).toBeGreaterThan(0)
    const rows = state.routineWrites[state.routineWrites.length - 1]
      .slice(1).map((r) => r.map(String))

    // Strength's Day A got the edit
    expect(rows.find((r) => r[0] === 'Strength' && r[2] === 'Squat')?.[3]).toBe('4')
    // Hypertrophy's Day A survives exactly once, and its exercise did not
    // leak into Strength
    expect(rows.filter((r) => r[0] === 'Hypertrophy' && r[1] === 'Day A' && r[2] === 'Lunge')).toHaveLength(1)
    expect(rows.some((r) => r[0] === 'Strength' && r[2] === 'Lunge')).toBe(false)
  })

  test('renaming a routine replaces its rows instead of duplicating', async ({ page }) => {
    await enterApp(page)
    await page.getByText('Day A', { exact: true }).click()

    const nameInput = page.getByRole('textbox', { name: 'Routine name' }).first()
    await nameInput.fill('Day A Prime')
    // leave the card so the deferred save flushes
    await page.getByRole('heading', { name: 'Routines' }).click()

    await expect.poll(() => state.routineWrites.length, { timeout: 10_000 }).toBeGreaterThan(0)
    const rows = state.routineWrites[state.routineWrites.length - 1].slice(1).map((r) => r.map(String))
    expect(rows.some((r) => r[1] === 'Day A Prime' && r[2] === 'Squat')).toBe(true)
    // the old name is gone — no duplicate routine
    expect(rows.some((r) => r[1] === 'Day A')).toBe(false)
    expect(rows.some((r) => r[1] === 'Day B' && r[2] === 'Deadlift')).toBe(true)
  })

  test('an empty draft named like an existing routine never persists (no data wipe)', async ({ page }) => {
    await enterApp(page)

    await page.getByRole('button', { name: '+ Add routine' }).click()
    const nameInput = page.getByRole('textbox', { name: 'Routine name' }).first()
    await nameInput.fill('Day B')
    await page.getByRole('heading', { name: 'Routines' }).click()
    await expect(page.getByText('A routine with this name already exists')).toBeVisible()

    // no write may have occurred — persisting an empty draft under an
    // existing name used to erase that routine's rows
    await page.waitForTimeout(1500)
    expect(state.routineWrites.length).toBe(0)
  })

  test('deleting a routine removes only its rows', async ({ page }) => {
    await enterApp(page)

    // swipe the collapsed Day A card to reveal its actions, then delete
    await swipeLeft(page.getByText('Day A', { exact: true }))
    await page.locator('button:visible', { hasText: 'Delete' }).first().click()

    await expect.poll(() => state.routineWrites.length, { timeout: 10_000 }).toBeGreaterThan(0)
    const written = state.routineWrites[state.routineWrites.length - 1]
    const rows = written.slice(1).map((r) => r.map(String))

    expect(rows.some((r) => r[1] === 'Day A')).toBe(false)
    expect(rows.some((r) => r[1] === 'Day B' && r[2] === 'Deadlift')).toBe(true)
    expect(rows.some((r) => r[0] === 'Hypertrophy' && r[2] === 'Curl')).toBe(true)
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

    await startWorkout(page, 'Day A')
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
    await startWorkout(page, 'Day A')
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

    await startWorkout(page, 'Day A')
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

    await startWorkout(page, 'Day A')
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

    await startWorkout(page, 'Day A')
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
    await startWorkout(page, 'Day A')
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
    await startWorkout(page, 'Day A')
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
