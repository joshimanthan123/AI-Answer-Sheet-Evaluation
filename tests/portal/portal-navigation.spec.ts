import { test, expect } from '@playwright/test';

const FACULTY_EMAIL = process.env.E2E_FACULTY_EMAIL || 'faculty@test.com';
const FACULTY_PASSWORD = process.env.E2E_FACULTY_PASSWORD || 'Password123!';
const STUDENT_EMAIL = process.env.E2E_STUDENT_EMAIL || 'student@test.com';
const STUDENT_PASSWORD = process.env.E2E_STUDENT_PASSWORD || 'Password123!';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@test.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'Password123!';

test.describe('Portal Navigation & Layout E2E Tests', () => {

  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('Faculty Dashboard and main navigation links function correctly', async ({ page }) => {
    await page.goto('/auth/login');
    await page.locator('input[type="email"]').fill(FACULTY_EMAIL);
    await page.locator('input[type="password"]').fill(FACULTY_PASSWORD);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await page.waitForURL('**/faculty**');

    // Check Faculty navigation pages
    await page.goto('/faculty/exams');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/faculty/exams');

    await page.goto('/faculty/reference-answers');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/faculty/reference-answers');

    await page.goto('/faculty/evaluations');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/faculty/evaluations');

    await page.goto('/faculty/reports');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/faculty/reports');

    await page.goto('/faculty/analytics');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/faculty/analytics');
  });

  test('Student Portal navigation links function correctly', async ({ page }) => {
    await page.goto('/auth/login');
    await page.locator('input[type="email"]').fill(STUDENT_EMAIL);
    await page.locator('input[type="password"]').fill(STUDENT_PASSWORD);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await page.waitForURL('**/student**');

    await page.goto('/student/exams');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/student/exams');

    await page.goto('/student/results');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/student/results');

    await page.goto('/student/analytics');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/student/analytics');
  });

  test('Admin Portal navigation links function correctly', async ({ page }) => {
    await page.goto('/auth/login');
    await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await page.waitForURL('**/admin**');

    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/admin/users');

    await page.goto('/admin/logs');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/admin/logs');
  });

});
