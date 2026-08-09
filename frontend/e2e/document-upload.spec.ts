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

test('upload dialog triages a batch before uploading, then reports what needs review', async ({
  page,
}) => {
  await page.click('button:has-text("Upload Receipt")')
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Upload Documents')).toBeVisible()

  // W6: the SegmentedControl kind picker is gone — auto-detected server-side now.
  await expect(dialog.getByText('Receipt / Bill')).not.toBeVisible()
  await expect(dialog.getByText('Bank / Card Statement')).not.toBeVisible()

  // X2: two entry points now — individual files and a whole folder. The folder input
  // carries `webkitdirectory`; both accept multiple.
  const fileInput = dialog.locator('input[type="file"]').first()
  const folderInput = dialog.locator('input[type="file"]').nth(1)
  await expect(fileInput).toHaveAttribute('multiple', '')
  await expect(folderInput).toHaveAttribute('webkitdirectory', '')

  await fileInput.setInputFiles([
    { name: 'test-1.png', mimeType: 'image/png', buffer: ONE_PX_PNG },
    { name: 'test-2.png', mimeType: 'image/png', buffer: ONE_PX_PNG },
  ])

  // X2: nothing uploads until the user confirms the plan. The triage summary and an
  // explicit "Upload N files" button must appear first — this is the regression guard
  // for the "a 200-file folder must not start uploading on drop" rule.
  const confirm = dialog.getByRole('button', { name: /^Upload \d+ files?$/ })
  await expect(confirm).toBeVisible({ timeout: 10000 })
  await expect(dialog.getByText('test-1.png')).toBeVisible()
  await expect(dialog.getByText('test-2.png')).toBeVisible()

  await confirm.click()

  // A batch is finished when the review queue knows about it, not when bytes land.
  await expect(dialog.getByText(/need(s)? reviewing on this page/)).toBeVisible({
    timeout: 20000,
  })
  await expect(dialog.getByText('Upload more')).toBeVisible()
})

test('re-uploading the same file is recognised instead of duplicated', async ({ page }) => {
  // X2: content-hashed, so a second drop of identical bytes is a safe no-op. Without
  // this, re-scanning a folder after adding one file would duplicate everything in it.
  // Unique bytes per run: every other test reuses ONE_PX_PNG, and content hashing
  // (correctly) treats those as the same file — so a shared buffer would make this test
  // pass or fail depending on execution order rather than on the behaviour under test.
  const uniqueBytes = Buffer.concat([ONE_PX_PNG, Buffer.from(`dupe-${Date.now()}`)])

  await page.click('button:has-text("Upload Receipt")')
  const dialog = page.getByRole('dialog')
  const fileInput = dialog.locator('input[type="file"]').first()

  await fileInput.setInputFiles([
    { name: 'dupe-check.png', mimeType: 'image/png', buffer: uniqueBytes },
  ])
  const confirm = dialog.getByRole('button', { name: /^Upload \d+ files?$/ })
  await expect(confirm).toBeVisible({ timeout: 10000 })
  await confirm.click()
  await expect(dialog.getByText('Upload more')).toBeVisible({ timeout: 20000 })

  // Same bytes again — should come back as already uploaded, with nothing to send.
  await dialog.getByRole('button', { name: 'Upload more' }).click()
  await dialog
    .locator('input[type="file"]')
    .first()
    .setInputFiles([{ name: 'dupe-check.png', mimeType: 'image/png', buffer: uniqueBytes }])
  // Appears twice by design — once in the triage summary badge ("1 already uploaded")
  // and once as the note on the row itself — so match the row's exact note.
  await expect(dialog.getByText('Already uploaded', { exact: true })).toBeVisible({
    timeout: 10000,
  })
  await expect(dialog.getByRole('button', { name: 'Upload 0 files' })).toBeDisabled()
})
