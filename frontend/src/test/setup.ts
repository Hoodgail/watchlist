import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

beforeEach(() => {
  globalThis.localStorage?.clear();
  globalThis.sessionStorage?.clear();
});

afterEach(() => {
  cleanup();
  globalThis.localStorage?.clear();
  globalThis.sessionStorage?.clear();
});
