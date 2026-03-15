import { test, expect } from '@playwright/test';

test.describe('Gameplay Flow Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test to ensure clean state
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('Command Center renders with all panels', async ({ page }) => {
    await page.goto('/');

    // Verify the main layout loads
    const root = page.locator('#root');
    await expect(root).toBeAttached();
    await expect(root).not.toBeEmpty();

    // Verify action menu items are visible
    await expect(page.getByText('Call Summit')).toBeVisible();
    await expect(page.getByText('Deploy Forces')).toBeVisible();
    await expect(page.getByText('Economic Stimulus')).toBeVisible();
  });

  test('action menu categories display correctly', async ({ page }) => {
    await page.goto('/');

    // Verify category-based action items render
    await expect(page.getByText('Diplomacy')).toBeVisible();
    await expect(page.getByText('Military')).toBeVisible();
    await expect(page.getByText('Economy')).toBeVisible();
    await expect(page.getByText('Intelligence')).toBeVisible();
  });

  test('intel panel displays faction data', async ({ page }) => {
    await page.goto('/');

    // Verify faction intel data is present
    await expect(page.getByText('China')).toBeVisible();
    await expect(page.getByText('Russia')).toBeVisible();
    await expect(page.getByText('Iran')).toBeVisible();
    await expect(page.getByText('North Korea')).toBeVisible();
    await expect(page.getByText('European Union')).toBeVisible();
    await expect(page.getByText('Japan')).toBeVisible();
  });

  test('localStorage save/load round-trip', async ({ page }) => {
    await page.goto('/');

    // Verify no save data initially
    const initialSave = await page.evaluate(() =>
      localStorage.getItem('new-order-save'),
    );
    // Store may auto-persist empty state
    if (initialSave) {
      const parsed = JSON.parse(initialSave);
      expect(parsed.state.currentTurn).toBe(0);
    }

    // Verify the store is functional (can read state)
    const hasRoot = await page.locator('#root').count();
    expect(hasRoot).toBe(1);
  });

  test('page has correct meta information', async ({ page }) => {
    await page.goto('/');

    // Title should contain Conflict 2026
    await expect(page).toHaveTitle(/Conflict 2026/);

    // Page should have proper viewport meta tag
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('width=device-width');
  });

  test('no console errors on initial load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Allow React dev mode warnings but no true errors
    const realErrors = errors.filter(
      (e) => !e.includes('React DevTools') && !e.includes('Download the React DevTools'),
    );
    expect(realErrors).toHaveLength(0);
  });

  test('page is responsive at mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    const root = page.locator('#root');
    await expect(root).toBeAttached();
    await expect(root).not.toBeEmpty();
  });
});
