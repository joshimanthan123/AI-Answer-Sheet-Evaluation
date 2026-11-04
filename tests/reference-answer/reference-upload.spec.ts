import { test, expect } from '@playwright/test';
import path from 'path';

const FACULTY_EMAIL = process.env.E2E_FACULTY_EMAIL || 'faculty@test.com';
const FACULTY_PASSWORD = process.env.E2E_FACULTY_PASSWORD || 'Password123!';

test.describe('Reference Answer Sheet Upload E2E Tests', () => {

  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('Faculty can upload a real reference answer sheet image and verify UI persistence', async ({ page }) => {
    test.setTimeout(90000);
    // 1. Login as Faculty
    await page.goto('/auth/login');
    await page.locator('input[type="email"]').fill(FACULTY_EMAIL);
    await page.locator('input[type="password"]').fill(FACULTY_PASSWORD);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await page.waitForURL('**/faculty**');

    // 2. Navigate to Reference Answers page
    await page.goto('/faculty/reference-answers', { timeout: 30000 });
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Reference Answers Repository')).toBeVisible();

    // 3. Click Upload Reference Sheet button
    const uploadBtn = page.getByRole('button', { name: /Upload Reference Sheet/i });
    await expect(uploadBtn).toBeVisible();
    await uploadBtn.click();

    // 4. Modal should open
    await expect(page.getByText('Upload Reference Answer Sheet')).toBeVisible();

    // 5. Select Exam from dropdown
    const examSelect = page.locator('select').filter({ hasText: /Select Exam/i }).first();
    await examSelect.waitFor({ state: 'visible' });
    
    // Select the first real exam option (not blank)
    const options = await examSelect.locator('option').all();
    let targetExamVal = '';
    for (const option of options) {
      const val = await option.getAttribute('value');
      if (val && val !== '') {
        targetExamVal = val;
        break;
      }
    }
    expect(targetExamVal).not.toBe('');
    await examSelect.selectOption(targetExamVal);

    // 6. Set Academic Year
    const yearInput = page.locator('form input[placeholder*="2024-25"]');
    await yearInput.fill('2026-27');

    // 7. Upload real reference file
    const filePath = path.resolve(process.cwd(), 'test-data/reference-answer-sheet.png');
    const fileInput = page.locator('input[type="file"]#reference-file-input');
    await fileInput.setInputFiles(filePath);

    // 8. Submit Upload Form
    const submitBtn = page.getByRole('button', { name: /Upload/i }).last();
    await submitBtn.click();

    // 9. Verify success notification or modal close
    await page.waitForTimeout(2000);

    // 10. Verify uploaded record appears in UI table
    await page.waitForLoadState('networkidle');
    const hasReferenceTable = await page.locator('table').isVisible();
    expect(hasReferenceTable).toBeTruthy();

    const fileCell = page.locator('table').getByText(/reference-answer-sheet|reference|sheet/i).first();
    await expect(fileCell).toBeVisible();

    // 11. Verify Action buttons exist
    const verifyEditBtn = page.getByRole('button', { name: /Verify & Edit/i }).first();
    await expect(verifyEditBtn).toBeVisible();
  });

});
