# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ocr\ocr-pipeline.spec.ts >> Live OCR Service Integration E2E Tests >> Express backend successfully proxies OCR requests to FastAPI PaddleOCR service
- Location: tests\ocr\ocr-pipeline.spec.ts:8:3

# Error details

```
Error: page.goto: net::ERR_NETWORK_ACCESS_DENIED at http://localhost:5173/auth/login
Call log:
  - navigating to "http://localhost:5173/auth/login", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | const FACULTY_EMAIL = process.env.E2E_FACULTY_EMAIL || 'faculty@test.com';
  4  | const FACULTY_PASSWORD = process.env.E2E_FACULTY_PASSWORD || 'Password123!';
  5  | 
  6  | test.describe('Live OCR Service Integration E2E Tests', () => {
  7  | 
  8  |   test('Express backend successfully proxies OCR requests to FastAPI PaddleOCR service', async ({ page }) => {
  9  |     // Intercept network requests to observe live OCR API status
  10 |     let ocrRequestObserved = false;
  11 |     let ocrStatus = 0;
  12 | 
  13 |     page.on('response', (response) => {
  14 |       const url = response.url();
  15 |       if ((url.includes('/api/v1/reference-answers') || url.includes('/process') || url.includes('/ocr')) && response.status() < 400) {
  16 |         ocrRequestObserved = true;
  17 |         ocrStatus = response.status();
  18 |       }
  19 |     });
  20 | 
  21 |     // Login and trigger OCR reload
> 22 |     await page.goto('/auth/login');
     |                ^ Error: page.goto: net::ERR_NETWORK_ACCESS_DENIED at http://localhost:5173/auth/login
  23 |     await page.locator('input[type="email"]').fill(FACULTY_EMAIL);
  24 |     await page.locator('input[type="password"]').fill(FACULTY_PASSWORD);
  25 |     await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  26 |     await page.waitForURL('**/faculty**');
  27 | 
  28 |     await page.goto('/faculty/reference-answers');
  29 |     await page.waitForLoadState('networkidle');
  30 | 
  31 |     // Click refresh or list
  32 |     await page.getByRole('button', { name: /Refresh/i }).first().click();
  33 |     await page.waitForTimeout(1000);
  34 | 
  35 |     expect(ocrRequestObserved).toBeTruthy();
  36 |     expect(ocrStatus).toBeLessThan(400);
  37 |   });
  38 | 
  39 | });
  40 | 
```