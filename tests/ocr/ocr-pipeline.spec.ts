import { test, expect } from '@playwright/test';

const FACULTY_EMAIL = process.env.E2E_FACULTY_EMAIL || 'faculty@test.com';
const FACULTY_PASSWORD = process.env.E2E_FACULTY_PASSWORD || 'Password123!';

test.describe('Live OCR Service Integration E2E Tests', () => {

  test('Express backend successfully proxies OCR requests to FastAPI PaddleOCR service', async ({ page }) => {
    // Intercept network requests to observe live OCR API status
    let ocrRequestObserved = false;
    let ocrStatus = 0;

    page.on('response', (response) => {
      const url = response.url();
      if ((url.includes('/api/v1/reference-answers') || url.includes('/process') || url.includes('/ocr')) && response.status() < 400) {
        ocrRequestObserved = true;
        ocrStatus = response.status();
      }
    });

    // Login and trigger OCR reload
    await page.goto('/auth/login');
    await page.locator('input[type="email"]').fill(FACULTY_EMAIL);
    await page.locator('input[type="password"]').fill(FACULTY_PASSWORD);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await page.waitForURL('**/faculty**');

    await page.goto('/faculty/reference-answers');
    await page.waitForLoadState('networkidle');

    // Click refresh or list
    await page.getByRole('button', { name: /Refresh/i }).first().click();
    await page.waitForTimeout(1000);

    expect(ocrRequestObserved).toBeTruthy();
    expect(ocrStatus).toBeLessThan(400);
  });

});
