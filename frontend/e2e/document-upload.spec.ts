import { test, expect } from '@playwright/test'

// W7: scoped e2e coverage for W1 (Activity filter bar) and W6 (upload pipeline
// upgrade — multi-file, auto-detect kind, no more manual picker). Registers its own
// user, independent of other specs' data.
const TEST_USER = {
  name: 'Upload Test User',
  email: `upload_${Date.now()}@example.com`,
  password: 'TestPass123!',
}

// A minimal valid 1x1 PNG — real bytes, not a placeholder string, so the upload
// exercises the actual server-side content-type/decoding path.
const ONE_PX_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

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
  await page.goto('/activity')
})

test('activity filter bar shows a live transaction count', async ({ page }) => {
  // W1: the count moved out of the page header into the filter bar (regression guard
  // — this exact text used to live in a standalone PageHeader subtitle).
  await expect(page.getByText(/^\d+ transactions?$/)).toBeVisible()
})

test('upload dialog has no manual receipt/statement picker and accepts multiple files', async ({
  page,
}) => {
  await page.click('button:has-text("Upload Receipt")')
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Upload Document')).toBeVisible()

  // W6: the SegmentedControl kind picker is gone — auto-detected server-side now.
  await expect(dialog.getByText('Receipt / Bill')).not.toBeVisible()
  await expect(dialog.getByText('Bank / Card Statement')).not.toBeVisible()

  const fileInput = dialog.locator('input[type="file"]')
  await expect(fileInput).toHaveAttribute('multiple', '')

  await fileInput.setInputFiles([
    { name: 'test-1.png', mimeType: 'image/png', buffer: ONE_PX_PNG },
    { name: 'test-2.png', mimeType: 'image/png', buffer: ONE_PX_PNG },
  ])

  // Per-file queue status (W6) — both should reach a terminal done/failed icon rather
  // than hanging on "uploading".
  await expect(dialog.getByText('test-1.png')).toBeVisible()
  await expect(dialog.getByText('test-2.png')).toBeVisible()
  await expect(dialog.getByText('Upload more')).toBeVisible({ timeout: 10000 })
})
