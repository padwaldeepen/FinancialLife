import { test, expect } from '@playwright/test'

const TEST_USER = {
  name: 'Test User',
  email: `testuser_${Date.now()}@example.com`,
  password: 'TestPass123!',
}

const API = 'http://localhost:8080'

let token: string
// Every financial route requires this — get_current_profile 400s without it (the
// country-profile model, see architecture-and-goals.md). Missing here broke the three
// /api/transactions/* API tests below; fixed alongside the `country` fix (W7).
let profileId: number
// Registration auto-creates default accounts for the new profile — grabbed once so
// the create-transaction test has a real account_id (TransactionCreate requires one).
let accountId: number

test.describe('Authentication Flow', () => {
  // Register the test user once before all tests. `country` is required by the
  // backend (routers/auth.py's UserRegister, the country-profile model) — omitting it
  // 422s and silently broke every test below that depends on `token` (found and fixed
  // here, W7; the UI-driven registration test further down was unaffected since
  // registerFormSlice defaults `country` to 'US' client-side).
  test.beforeAll(async () => {
    const res = await fetch(`${API}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_USER.email,
        username: TEST_USER.email.split('@')[0],
        password: TEST_USER.password,
        full_name: TEST_USER.name,
        country: 'US',
      }),
    })
    if (res.status !== 200) {
      throw new Error(`beforeAll registration failed: ${res.status} ${await res.text()}`)
    }
    const data = await res.json()
    token = data.access_token
    profileId = data.profiles[0].id

    const accountsRes = await fetch(`${API}/api/accounts/`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Profile-Id': String(profileId) },
    })
    const accounts = await accountsRes.json()
    accountId = accounts[0].id
  })

  // ─── REGISTRATION ───────────────────────────
  test.describe('Registration', () => {
    test('should show the registration form', async ({ page }) => {
      await page.goto('/register')
      await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible()
      await expect(page.locator('#fullName')).toBeVisible()
      await expect(page.locator('#regEmail')).toBeVisible()
      await expect(page.locator('#regPassword')).toBeVisible()
    })

    test('should show validation errors on empty submit', async ({ page }) => {
      await page.goto('/register')
      await page.click('button[type="submit"]')
      await expect(page.getByText('required').first()).toBeVisible({ timeout: 3000 })
    })

    test('should stay on register when email is invalid', async ({ page }) => {
      await page.goto('/register')
      await page.fill('#fullName', TEST_USER.name)
      await page.fill('#regEmail', 'notanemail')
      await page.fill('#regPassword', 'pass123')
      await page.click('button[type="submit"]')
      await expect(page).toHaveURL('/register')
    })

    test('should register a new user successfully', async ({ page }) => {
      const altEmail = `alt_${TEST_USER.email}`
      await page.goto('/register')
      await page.fill('#fullName', TEST_USER.name)
      await page.fill('#regUsername', altEmail.split('@')[0]!)
      await page.fill('#regEmail', altEmail)
      await page.fill('#regPassword', TEST_USER.password)
      await page.fill('#regConfirmPassword', TEST_USER.password)
      await page.click('button[type="submit"]')
      await page.waitForURL('/', { timeout: 10000 })
    })
  })

  // ─── LOGIN ─────────────────────────────────
  test.describe('Login', () => {
    test('should show the login form', async ({ page }) => {
      await page.goto('/login')
      await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()
      await expect(page.locator('#email')).toBeVisible()
      await expect(page.locator('#password')).toBeVisible()
    })

    test('should show error for wrong password', async ({ page }) => {
      await page.goto('/login')
      await page.fill('#email', TEST_USER.email)
      await page.fill('#password', 'wrongpassword')
      const [response] = await Promise.all([
        page.waitForResponse((res) => res.url().includes('/api/auth/login')),
        page.click('button[type="submit"]'),
      ])
      expect(response.status()).toBe(401)
      await expect(page).toHaveURL('/login')
    })

    test('should login successfully', async ({ page }) => {
      await page.goto('/login')
      await page.fill('#email', TEST_USER.email)
      await page.fill('#password', TEST_USER.password)
      await page.click('button[type="submit"]')
      await page.waitForURL('/', { timeout: 10000 })
    })
  })

  // ─── API ENDPOINTS ─────────────────────────
  test.describe('API Endpoints', () => {
    test('POST /api/auth/login - should login via API', async () => {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: TEST_USER.email, password: TEST_USER.password }),
      })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toHaveProperty('access_token')
      token = data.access_token
    })

    test('GET /api/auth/me - should return user info', async () => {
      const res = await fetch(`${API}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.email).toBe(TEST_USER.email)
    })

    test('GET /health - should return ok', async () => {
      const res = await fetch(`${API}/health`)
      expect(res.status).toBe(200)
    })

    test('GET /api/transactions/ - should list transactions', async () => {
      const res = await fetch(`${API}/api/transactions/`, {
        headers: { Authorization: `Bearer ${token}`, 'X-Profile-Id': String(profileId) },
      })
      expect(res.status).toBe(200)
    })

    test('POST /api/transactions/ - should create a transaction', async () => {
      const res = await fetch(`${API}/api/transactions/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Profile-Id': String(profileId),
        },
        body: JSON.stringify({
          description: 'E2E test transaction',
          amount: 42.5,
          date: new Date().toISOString().split('T')[0],
          transaction_type: 'expense',
          account_id: accountId,
        }),
      })
      expect(res.status).toBe(201)
    })

    test('POST /api/transactions/parse - NL quick-add', async () => {
      const res = await fetch(`${API}/api/transactions/parse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Profile-Id': String(profileId),
        },
        body: JSON.stringify({ text: 'spent 15 dollars on pizza yesterday' }),
      })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toHaveProperty('description')
    })
  })

  // ─── UI NAVIGATION ─────────────────────────
  // Real routes/copy per the app's actual 5-page desktop map (design-system.md §3):
  // Home/Activity/Recurring/Insights/Manage — the original `/transactions`, `/budgets`,
  // and a "Dashboard" heading never existed in this app; fixed while restoring this
  // suite to a passing state (W7).
  test.describe('UI Navigation (authenticated)', () => {
    test('should navigate all pages after login', async ({ page }) => {
      await page.goto('/login')
      await page.fill('#email', TEST_USER.email)
      await page.fill('#password', TEST_USER.password)
      await page.click('button[type="submit"]')
      await page.waitForURL('/', { timeout: 10000 })

      await page.waitForLoadState('networkidle')
      await expect(page.getByText('Safe to Spend')).toBeVisible()

      for (const path of ['/activity', '/recurring', '/insights', '/manage']) {
        await page.goto(path)
        await page.waitForLoadState('networkidle')
        await expect(page).toHaveURL(path)
      }
    })
  })
})
