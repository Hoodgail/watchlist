import { describe } from 'vitest';
import { shouldRunDatabaseTests } from './setup.js';

export function describeDb(name: string, factory: () => void): void {
  if (shouldRunDatabaseTests) {
    describe(name, factory);
    return;
  }

  describe.skip(name, factory);
}
