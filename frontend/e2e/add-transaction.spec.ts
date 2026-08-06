import { test, expect } from '@playwright/test'

// W7: scoped e2e coverage for W0/W4's Add Transaction fixes — the Parse/Confirm button
// alignment fix and the quick-add flow they sit in. Registers its own user (same
// pattern as auth-flow.spec.ts) so this is independent of any other test's data.
const TEST_USER = {
  name: 'Add Txn Test User',
  email: `addtxn_${Date.now()}@example.com`,
  password: 'TestPass123!',
}

test.beforeAll(async ({ request }) => {
  const res = await request.post('http://localhost:8080/api/auth/register', {
    data: {
      email: TEST_USER.email,
      username: TEST_USER.email.split('@')[0],
      password: TEST_USER.password,
      full_name: TEST_USER.name,
      country: 'US',
    },
  })
  expect(res.status()).toBe(200)
})

test.beforeEach(async ({ page }) => {
  await page.goto('/login')
  await page.fill('#email', TEST_USER.email)
  await page.fill('#password', TEST_USER.password)
  await page.click('button[type="submit"]')
  await page.waitForURL('/', { timeout: 10000 })
})

test('quick-add: parse then confirm creates a transaction, buttons right-aligned', async ({
  page,
}) => {
  await page.click('button:has-text("Add Transaction")')
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Quick Add')).toBeVisible()

  await page.fill('input[placeholder*="spent 15"]', 'spent 12 on coffee')

  const parseButton = dialog.getByRole('button', { name: /parse/i })
  const parseBox = await parseButton.boundingBox()
  const dialogBox = await dialog.boundingBox()
  // W0: the Parse/Confirm row sits inside `Flex justify="end"` — regression guard that
  // it stays right-aligned, not the pre-fix left-aligned default.
  expect(parseBox!.x + parseBox!.width).toBeGreaterThan(dialogBox!.x + dialogBox!.width * 0.6)

  await parseButton.click()
  await expect(dialog.getByText('Food & Dining')).toBeVisible({ timeout: 5000 })

  await dialog.getByRole('button', { name: /confirm.*save/i }).click()
  await expect(dialog).not.toBeVisible({ timeout: 5000 })

  await page.goto('/activity')
  await expect(page.getByText('Coffee').first()).toBeVisible({ timeout: 5000 })
})
