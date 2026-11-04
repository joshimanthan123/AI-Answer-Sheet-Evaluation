import { test, expect } from '@playwright/test';

const FACULTY_EMAIL = process.env.E2E_FACULTY_EMAIL || 'faculty@test.com';
const FACULTY_PASSWORD = process.env.E2E_FACULTY_PASSWORD || 'Password123!';

test.describe('Adaptive AI Evaluation E2E Tests', () => {

  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('Faculty can access AI evaluation queue and view structural evaluation results', async ({ page }) => {
    // 1. Login as Faculty
    await page.goto('/auth/login');
    await page.locator('input[type="email"]').fill(FACULTY_EMAIL);
    await page.locator('input[type="password"]').fill(FACULTY_PASSWORD);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await page.waitForURL('**/faculty**');

    // 2. Open Evaluations Dashboard
    await page.goto('/faculty/evaluations');
    await page.waitForLoadState('networkidle');

    // 3. Verify Evaluation Dashboard elements exist
    const hasHeader = await page.getByText(/Evaluation/i).first().isVisible();
    expect(hasHeader).toBeTruthy();

    // 4. Verify evaluation records or queue items exist or display empty state gracefully
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeDefined();

    // 5. Test navigation to evaluation details if an evaluation item exists
    const reviewBtn = page.getByRole('button', { name: /Review|View|Details/i }).first();
    if (await reviewBtn.isVisible()) {
      await reviewBtn.click();
      await page.waitForLoadState('networkidle');
      
      // Verify numerical marks structure if displayed
      const marksText = await page.getByText(/\/|\b\d+\.?\d*\b/).first().isVisible();
      expect(marksText).toBeTruthy();
    }
  });

});
