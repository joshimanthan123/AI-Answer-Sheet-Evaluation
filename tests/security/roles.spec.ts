import { test, expect } from '@playwright/test';

const STUDENT_EMAIL = process.env.E2E_STUDENT_EMAIL || 'student@test.com';
const STUDENT_PASSWORD = process.env.E2E_STUDENT_PASSWORD || 'Password123!';
const FACULTY_EMAIL = process.env.E2E_FACULTY_EMAIL || 'faculty@test.com';
const FACULTY_PASSWORD = process.env.E2E_FACULTY_PASSWORD || 'Password123!';

test.describe('Role Security & Authorization E2E Tests', () => {

  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('Unauthenticated user navigating directly to protected routes is redirected to login', async ({ page }) => {
    await page.goto('/faculty/dashboard');
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/auth/login');

    await page.goto('/student/dashboard');
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/auth/login');

    await page.goto('/admin/dashboard');
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/auth/login');
  });

  test('Student cannot access Faculty or Admin portal routes via direct URL navigation', async ({ page }) => {
    // 1. Login as Student
    await page.goto('/auth/login');
    await page.locator('input[type="email"]').fill(STUDENT_EMAIL);
    await page.locator('input[type="password"]').fill(STUDENT_PASSWORD);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await page.waitForURL('**/student**');

    // 2. Try navigating to Faculty route directly
    await page.goto('/faculty/reference-answers');
    await page.waitForTimeout(1000);

    // Verify access denied or redirect away from faculty route
    const currentUrl = page.url();
    const isBlocked = currentUrl.includes('/student') || currentUrl.includes('/auth') || currentUrl.includes('/404');
    expect(isBlocked).toBeTruthy();

    // 3. Try navigating to Admin route directly
    await page.goto('/admin/users');
    await page.waitForTimeout(1000);
    const adminUrl = page.url();
    const isAdminBlocked = adminUrl.includes('/student') || adminUrl.includes('/auth') || adminUrl.includes('/404');
    expect(isAdminBlocked).toBeTruthy();
  });

  test('Faculty cannot access Admin-only portal routes via direct URL navigation', async ({ page }) => {
    // 1. Login as Faculty
    await page.goto('/auth/login');
    await page.locator('input[type="email"]').fill(FACULTY_EMAIL);
    await page.locator('input[type="password"]').fill(FACULTY_PASSWORD);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await page.waitForURL('**/faculty**');

    // 2. Try navigating to Admin route
    await page.goto('/admin/logs');
    await page.waitForTimeout(1000);

    const currentUrl = page.url();
    const isBlocked = currentUrl.includes('/faculty') || currentUrl.includes('/auth') || currentUrl.includes('/404');
    expect(isBlocked).toBeTruthy();
  });

});
