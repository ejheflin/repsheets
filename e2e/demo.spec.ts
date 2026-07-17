import { test, expect } from '@playwright/test'
import { stubThirdPartyScripts } from './support/googleMocks'

test.describe('demo mode', () => {
  test.beforeEach(async ({ context, page }) => {
    await stubThirdPartyScripts(context)
    await context.addInitScript(() => {
      localStorage.setItem('repsheets_demo', '1')
      localStorage.setItem('repsheets_tour_done', '1')
      localStorage.setItem('repsheets_install_hint_dismissed', '1')
    })
    await page.goto('/app.html')
  })

  test('shows demo routines', async ({ page }) => {
    await expect(page.getByText('Demo Mode')).toBeVisible()
    await expect(page.getByText('Day A1')).toBeVisible()
    await expect(page.getByText('Day A2')).toBeVisible()
    await expect(page.getByText('Day B1')).toBeVisible()
  })

  test('starts a workout and completes sets', async ({ page }) => {
    await page.getByText('Day A1').click()
    await expect(page.getByRole('heading', { name: 'Day A1' })).toBeVisible()
    await expect(page.getByText('Squat (T1)')).toBeVisible()
    await expect(page.getByText('Bench Press (T2)')).toBeVisible()

    // finish with unchecked sets -> confirmation sheet appears
    await page.getByRole('button', { name: 'Finish' }).click()
    await expect(page.getByText('Finish Workout?')).toBeVisible()
  })

  test('logs tab renders calendar, chart, and PRs', async ({ page }) => {
    await page.getByRole('button', { name: 'Logs' }).click()
    await expect(page.getByRole('heading', { name: 'Logs' })).toBeVisible()
    // calendar + progress chart + personal records render without crashing
    await expect(page.locator('svg').first()).toBeVisible()
  })
})
