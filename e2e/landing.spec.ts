import { test, expect } from '@playwright/test'

test.describe('landing page', () => {
  test('renders and links to the app', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(String(e)))

    await page.goto('/')
    await expect(page).toHaveTitle(/repsheets/i)
    await expect(page.locator('a[href="/app.html"]').first()).toBeVisible()

    // scroll through the GSAP stages to catch runtime errors
    for (let i = 0; i < 10; i++) {
      await page.mouse.wheel(0, 800)
      await page.waitForTimeout(150)
    }
    expect(errors).toEqual([])
  })
})
