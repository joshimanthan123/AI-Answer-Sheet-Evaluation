import { test, expect } from '@playwright/test';

const FACULTY_EMAIL = process.env.E2E_FACULTY_EMAIL || 'faculty@test.com';
const FACULTY_PASSWORD = process.env.E2E_FACULTY_PASSWORD || 'Password123!';
const STUDENT_EMAIL = process.env.E2E_STUDENT_EMAIL || 'student@test.com';
const STUDENT_PASSWORD = process.env.E2E_STUDENT_PASSWORD || 'Password123!';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@test.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'Password123!';

test.describe('Authentication Module E2E Tests', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
  });

  test('should display login page correctly', async ({ page }) => {
    await expect(page).toHaveTitle(/GradeAI|Evaluation/i);
    await expect(page.getByText('Sign In to GradeAI')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();
  });

  test('should reject invalid credentials with proper error message', async ({ page }) => {
    await page.locator('input[type="email"]').fill('invalid_user@test.com');
    await page.locator('input[type="password"]').fill('WrongPassword999!');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    // Verify rejection & error message without exposing credentials
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/auth/login');
    const hasErrorMsg = await page.getByText(/invalid|incorrect|unauthorized/i).isVisible();
    expect(hasErrorMsg).toBeTruthy();
  });

  test('should authenticate valid Faculty user and navigate to Faculty Portal', async ({ page }) => {
    await page.locator('input[type="email"]').fill(FACULTY_EMAIL);
    await page.locator('input[type="password"]').fill(FACULTY_PASSWORD);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    await page.waitForURL('**/faculty**', { timeout: 15000 });
    expect(page.url()).toContain('/faculty');
  });

  test('should authenticate valid Student user and navigate to Student Portal', async ({ page }) => {
    await page.locator('input[type="email"]').fill(STUDENT_EMAIL);
    await page.locator('input[type="password"]').fill(STUDENT_PASSWORD);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    await page.waitForURL('**/student**', { timeout: 15000 });
    expect(page.url()).toContain('/student');
  });

  test('should authenticate valid Admin user and navigate to Admin Portal', async ({ page }) => {
    await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    await page.waitForURL('**/admin**', { timeout: 15000 });
    expect(page.url()).toContain('/admin');
  });

});
