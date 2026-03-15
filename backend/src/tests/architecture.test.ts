import path from 'node:path';
import { promises as fs } from 'node:fs';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '..');

async function collectCodeFiles(relativeDir: string): Promise<string[]> {
  const absoluteDir = path.resolve(repoRoot, relativeDir);

  try {
    const entries = await fs.readdir(absoluteDir, { withFileTypes: true });
    const nested = await Promise.all(entries.map(async (entry) => {
      const entryPath = path.join(relativeDir, entry.name);

      if (entry.isDirectory()) {
        return collectCodeFiles(entryPath);
      }

      if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        return [entryPath];
      }

      return [];
    }));

    return nested.flat();
  } catch {
    return [];
  }
}

async function expectNoForbiddenImports(
  relativeDir: string,
  forbiddenPatterns: RegExp[],
): Promise<void> {
  const files = await collectCodeFiles(relativeDir);
  const violations: string[] = [];

  for (const relativeFile of files) {
    const content = await fs.readFile(path.resolve(repoRoot, relativeFile), 'utf8');

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(content)) {
        violations.push(`${relativeFile} matches ${pattern}`);
      }
    }
  }

  expect(violations).toEqual([]);
}

describe('Architecture safety rails', () => {
  it('keeps repo-level shared code runtime-agnostic', async () => {
    await expectNoForbiddenImports('shared', [
      /from ['"]react['"]/, 
      /from ['"]react-dom['"]/, 
      /from ['"]express['"]/, 
      /from ['"]@prisma\/client['"]/, 
      /from ['"]vite['"]/, 
      /from ['"]node:/,
    ]);
  });

  it('keeps backend shared code free of frontend/browser imports', async () => {
    await expectNoForbiddenImports('backend/src/shared', [
      /from ['"]react['"]/, 
      /from ['"]react-dom['"]/, 
      /frontend\//, 
      /import\.meta/, 
      /window\./,
    ]);
  });

  it('keeps frontend shared code free of backend/server imports', async () => {
    await expectNoForbiddenImports('frontend/src/shared', [
      /from ['"]express['"]/, 
      /from ['"]@prisma\/client['"]/, 
      /backend\//, 
      /from ['"]node:/,
    ]);
  });
});
