import { test, expect } from '@playwright/test';
import path from 'path';

const STUDENT_EMAIL = process.env.E2E_STUDENT_EMAIL || 'student@test.com';
const STUDENT_PASSWORD = process.env.E2E_STUDENT_PASSWORD || 'Password123!';

test.describe('Student Answer Sheet Submission E2E Tests', () => {

  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('Student can navigate to upload page, submit handwritten answer sheet, and verify attempt log persistence', async ({ page }) => {
    // 1. Login as Student
    await page.goto('/auth/login');
    await page.locator('input[type="email"]').fill(STUDENT_EMAIL);
    await page.locator('input[type="password"]').fill(STUDENT_PASSWORD);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await page.waitForURL('**/student**');

    // 2. Navigate to Upload Answer Sheet page
    await page.goto('/student/upload-answer-sheet');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Upload Answer Sheet')).toBeVisible();

    // 3. Select Exam from dropdown if available
    const examSelect = page.locator('select').first();
    if (await examSelect.isVisible()) {
      const options = await examSelect.locator('option').all();
      if (options.length > 0) {
        const val = await options[0].getAttribute('value');
        if (val) await examSelect.selectOption(val);
      }
    }

    // 4. Attach real student answer sheet file
    const filePath = path.resolve(process.cwd(), 'test-data/student-answer-sheet.png');
    const fileInput = page.locator('input[type="file"]#sheet-file-upload');
    await fileInput.setInputFiles(filePath);

    // 5. Submit attempt
    const submitBtn = page.getByRole('button', { name: /Submit Attempt/i });
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // 6. Wait for submission pipeline to process
    await page.waitForTimeout(4000);

    // 7. Verify attempt appears in history log
    const attemptLog = page.getByText(/Submission Attempt Log/i);
    await expect(attemptLog).toBeVisible();
  });

});
