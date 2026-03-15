import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('page loads with correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/New Order/);
  });

  test('React app mounts into #root', async ({ page }) => {
    await page.goto('/');
    const root = page.locator('#root');
    await expect(root).toBeAttached();
    // Verify React has rendered something inside #root
    await expect(root).not.toBeEmpty();
  });
});
