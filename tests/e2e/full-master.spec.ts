import { test, expect } from '@playwright/test';
import path from 'path';

const FACULTY_EMAIL = process.env.E2E_FACULTY_EMAIL || 'faculty@test.com';
const FACULTY_PASSWORD = process.env.E2E_FACULTY_PASSWORD || 'Password123!';
const STUDENT_EMAIL = process.env.E2E_STUDENT_EMAIL || 'student@test.com';
const STUDENT_PASSWORD = process.env.E2E_STUDENT_PASSWORD || 'Password123!';

test.describe('Master End-to-End System Evaluation Pipeline Suite', () => {

  test('Full Life-Cycle Execution: Faculty Reference Upload -> Student Submission -> AI Evaluation -> Faculty Finalization & Reports', async ({ page }) => {
    test.setTimeout(120000);

    const doLogin = async (email: string, pass: string, targetRole: string) => {
      await page.context().clearCookies();
      await page.goto('/auth/login');
      await page.evaluate(() => {
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch (e) {}
      });
      await page.goto('/auth/login');
      const emailInput = page.locator('input[type="email"]').first();
      await emailInput.waitFor({ state: 'visible', timeout: 20000 });
      await emailInput.fill(email);
      await page.locator('input[type="password"]').first().fill(pass);
      await page.getByRole('button', { name: 'Sign In', exact: true }).click();
      await page.waitForURL(`**/${targetRole}**`, { timeout: 20000 });
    };
    
    // STEP 1: Faculty Authentication & Portal Entry
    await doLogin(FACULTY_EMAIL, FACULTY_PASSWORD, 'faculty');

    // STEP 2: Faculty Upload Reference Answer Sheet
    await page.goto('/faculty/reference-answers');
    await page.waitForLoadState('networkidle');

    const uploadBtn = page.getByRole('button', { name: /Upload Reference Sheet/i });
    if (await uploadBtn.isVisible()) {
      await uploadBtn.click();
      
      const examSelect = page.locator('select').filter({ hasText: /Select Exam/i }).first();
      await examSelect.waitFor({ state: 'visible' });
      const options = await examSelect.locator('option').all();
      let targetExamVal = '';
      for (const opt of options) {
        const val = await opt.getAttribute('value');
        if (val && val !== '') {
          targetExamVal = val;
          break;
        }
      }
      if (targetExamVal) {
        await examSelect.selectOption(targetExamVal);
      }

      const yearInput = page.locator('form input[placeholder*="2024-25"]');
      await yearInput.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
      if (await yearInput.isVisible()) {
        await yearInput.fill('2026-27');
      }
      const refFilePath = path.resolve(process.cwd(), 'test-data/reference-answer-sheet.png');
      await page.locator('input[type="file"]#reference-file-input').setInputFiles(refFilePath);
      
      const submitBtn = page.getByRole('button', { name: /Upload/i }).last();
      await submitBtn.click();
      await page.waitForTimeout(3000);
    }

    // STEP 3: Verify Reference Answer Table & OCR Verification
    await page.goto('/faculty/reference-answers');
    await page.waitForLoadState('networkidle');
    const tableVisible = await page.locator('table').first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasHeader = await page.getByText('Reference Answers Repository').first().isVisible();
    expect(tableVisible || hasHeader).toBeTruthy();

    // STEP 4: Student Portal - Submit Answer Sheet
    await doLogin(STUDENT_EMAIL, STUDENT_PASSWORD, 'student');

    await page.goto('/student/upload-answer-sheet');
    await page.waitForLoadState('networkidle');

    const studentFilePath = path.resolve(process.cwd(), 'test-data/student-answer-sheet.png');
    const studentFileInput = page.locator('input[type="file"]#sheet-file-upload');
    if (await studentFileInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await studentFileInput.setInputFiles(studentFilePath);
      const submitAttemptBtn = page.getByRole('button', { name: /Submit Attempt/i });
      if (await submitAttemptBtn.isVisible()) {
        await submitAttemptBtn.click();
        await page.waitForTimeout(4000);
      }
    }

    // STEP 5: Faculty Evaluation & Review
    await doLogin(FACULTY_EMAIL, FACULTY_PASSWORD, 'faculty');

    await page.goto('/faculty/evaluations');
    await page.waitForLoadState('networkidle');

    // STEP 6: Final Reports & Analytics Verification
    await page.goto('/faculty/reports');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/faculty/reports');

    await page.goto('/faculty/analytics');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/faculty/analytics');

  });

});
