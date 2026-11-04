import { test, expect } from '@playwright/test';

const FACULTY_EMAIL = process.env.E2E_FACULTY_EMAIL || 'faculty@test.com';
const FACULTY_PASSWORD = process.env.E2E_FACULTY_PASSWORD || 'Password123!';

test.describe('Network Loop & Request Anomaly Detection E2E Tests', () => {

  test('Monitoring navigation does not trigger repeated API request loops', async ({ page }) => {
    const requestCounts: Record<string, number> = {};

    // Monitor outgoing HTTP requests
    page.on('request', (request) => {
      const urlPath = new URL(request.url()).pathname;
      requestCounts[urlPath] = (requestCounts[urlPath] || 0) + 1;
    });

    // Login and navigate through primary pages
    await page.goto('/auth/login');
    await page.locator('input[type="email"]').fill(FACULTY_EMAIL);
    await page.locator('input[type="password"]').fill(FACULTY_PASSWORD);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await page.waitForURL('**/faculty**');

    await page.goto('/faculty/reference-answers');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Verify no single API endpoint was bombarded in a loop (threshold > 10 calls)
    for (const [endpoint, count] of Object.entries(requestCounts)) {
      if (endpoint.startsWith('/api/')) {
        expect(count, `API endpoint '${endpoint}' was invoked ${count} times (possible request loop)`).toBeLessThan(12);
      }
    }
  });

});
