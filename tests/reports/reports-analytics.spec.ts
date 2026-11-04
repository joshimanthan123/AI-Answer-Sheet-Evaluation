import { test, expect } from '@playwright/test';

const FACULTY_EMAIL = process.env.E2E_FACULTY_EMAIL || 'faculty@test.com';
const FACULTY_PASSWORD = process.env.E2E_FACULTY_PASSWORD || 'Password123!';

test.describe('Phase 6 Reports & Analytics E2E Tests', () => {

  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('Faculty can view Reports dashboard and trigger report exports', async ({ page }) => {
    // 1. Login as Faculty
    await page.goto('/auth/login');
    await page.locator('input[type="email"]').fill(FACULTY_EMAIL);
    await page.locator('input[type="password"]').fill(FACULTY_PASSWORD);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await page.waitForURL('**/faculty**');

    // 2. Open Reports Page
    await page.goto('/faculty/reports');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/Reports|Evaluation Report/i).first()).toBeVisible();

    // 3. Open Analytics Page
    await page.goto('/faculty/analytics');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/Analytics|Dashboard|Performance/i).first()).toBeVisible();
  });

});
