/**
 * Vitest Global Test Setup
 *
 * This file runs before every test suite. It ensures that the test
 * environment is correctly configured for:
 *
 * 1. localStorage — Required by Zustand's `persist` middleware.
 *    happy-dom provides a localStorage implementation, but we clear it
 *    here to guarantee a clean slate for each test run.
 *
 * 2. Any future global mocks or polyfills needed by the test suite.
 */

import { beforeEach } from 'vitest';

// Ensure localStorage is clear before each test to prevent
// Zustand persist middleware from leaking state between tests.
beforeEach(() => {
  localStorage.clear();
});
