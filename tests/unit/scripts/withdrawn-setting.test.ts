import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { withdrawnSettingTermsIn } from '@/core/content/style';

/*
 * Understory is a generic platform (AGENTS.md, law 10). The validator guards lesson
 * files; this ratchet guards everything else that ships or mirrors what ships: labs,
 * placement, app copy, contracts, the Swift package and the tests.
 */

const ROOT = path.resolve(__dirname, '../../..');
const SCANNED = ['content', 'src', 'contracts', 'tests', 'ios/UnderstoryKit', 'README.md'];
const TEXT = /\.(tsx?|css|ya?ml|json|md|swift)$/;
const SKIPPED = new Set([
  // Where the terms are defined and tested.
  'src/core/content/style.ts',
  'tests/unit/core/content/validate.test.ts',
  'tests/unit/core/content/notes-check.test.ts',
  'tests/unit/scripts/withdrawn-setting.test.ts',
]);

function filesUnder(relative: string): string[] {
  const full = path.join(ROOT, relative);
  if (statSync(full).isFile()) return [relative];
  return readdirSync(full).flatMap((name) =>
    name === 'node_modules' || name === '.build' || name.startsWith('.')
      ? []
      : filesUnder(path.join(relative, name)),
  );
}

const offenders = new Map(
  SCANNED.flatMap(filesUnder)
    .filter((file) => TEXT.test(file) && !SKIPPED.has(file))
    .map(
      (file) =>
        [file, withdrawnSettingTermsIn(readFileSync(path.join(ROOT, file), 'utf8'))] as const,
    )
    .filter(([, terms]) => terms.length > 0),
);

describe('withdrawn setting', () => {
  // Every lesson and lab was rewritten, so the list of files allowed to carry it is empty.
  // The validator makes it an error in lessons; this test covers everything else that ships.
  it('appears in no file', () => {
    expect([...offenders].map(([file, terms]) => `${file}: ${terms.join(', ')}`)).toEqual([]);
  });
});
