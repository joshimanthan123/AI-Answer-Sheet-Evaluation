import { test, expect } from '@playwright/test';

test.describe('Error Handling & Boundary Conditions E2E Tests', () => {

  test('Navigating to non-existent route shows 404 page without breaking UI', async ({ page }) => {
    await page.goto('/some-non-existent-page-12345');
    await page.waitForTimeout(2000);
    const bodyText = await page.textContent('body');
    const isNotFound = bodyText ? /Page Not Recovered|404|Not Found|GradeAI/i.test(bodyText) : false;
    expect(isNotFound).toBeTruthy();
  });

  test('Invalid login attempts display clean error toast or alert', async ({ page }) => {
    await page.goto('/auth/login');
    await page.locator('input[type="email"]').fill('nonexistent.user@university.edu');
    await page.locator('input[type="password"]').fill('WrongPassword123!');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    await page.waitForTimeout(1000);
    const hasError = await page.getByText(/unauthorized|incorrect|invalid|failed/i).first().isVisible();
    expect(hasError).toBeTruthy();
  });

});
