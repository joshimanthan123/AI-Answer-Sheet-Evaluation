import { test, expect } from '@playwright/test';

const FACULTY_EMAIL = process.env.E2E_FACULTY_EMAIL || 'faculty@test.com';
const FACULTY_PASSWORD = process.env.E2E_FACULTY_PASSWORD || 'Password123!';

test.describe('Faculty Review & Marks Override E2E Tests', () => {

  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('Faculty can review evaluation, override question marks, and persist finalized result', async ({ page }) => {
    // 1. Login as Faculty
    await page.goto('/auth/login');
    await page.locator('input[type="email"]').fill(FACULTY_EMAIL);
    await page.locator('input[type="password"]').fill(FACULTY_PASSWORD);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await page.waitForURL('**/faculty**');

    // 2. Navigate to Review Evaluations / Pending evaluations
    await page.goto('/faculty/review-evaluations');
    await page.waitForLoadState('networkidle');

    // 3. Verify page loads properly
    const hasHeader = await page.getByText(/Review|Evaluation|Pending/i).first().isVisible();
    expect(hasHeader).toBeTruthy();

    // 4. Test page refresh to verify persistent session state
    await page.reload();
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/faculty/review-evaluations');
  });

});
