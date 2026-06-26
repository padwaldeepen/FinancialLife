import { test, expect } from '@playwright/test'

test('debug - check register page', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(`PAGE ERROR: ${err.message}`))

  await page.goto('/register', { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)

  await page.screenshot({ path: 'test-results/debug-register.png', fullPage: true })

  console.log('=== CONSOLE ERRORS ===')
  for (const e of errors) console.log(`  ERROR: ${e}`)

  const bodyText = await page.locator('body').innerText()
  console.log('=== BODY TEXT ===')
  console.log(bodyText.slice(0, 1000))

  const inputs = await page.locator('input').count()
  console.log('=== INPUT COUNT ===', inputs)
  for (let i = 0; i < inputs; i++) {
    const id = await page.locator('input').nth(i).getAttribute('id')
    console.log(`  Input #${i}: id="${id}"`)
  }

  await expect(page.locator('body')).toBeVisible()
})
