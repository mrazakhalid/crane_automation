import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

/**
 * Vitest setup — registers jest-dom matchers and unmounts React trees between
 * tests so component tests stay isolated.
 */
afterEach(() => {
  cleanup();
});
