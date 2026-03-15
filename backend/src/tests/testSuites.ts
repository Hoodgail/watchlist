import { describe } from 'vitest';
import { databaseAvailable } from './setup.js';

export function describeDb(name: string, factory: () => void): void {
  if (databaseAvailable) {
    describe(name, factory);
    return;
  }

  describe.skip(name, factory);
}
