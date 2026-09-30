import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * The site is open to anyone. Today nothing on the server costs money or CPU per request:
 * pages and the content bundle are static, the code runner runs in the learner's browser,
 * and news is fetched by GitHub Actions. This ratchet keeps it that way. A route handler or
 * server action that runs per request (sync, an AI call, a proxy) must be rate-limited
 * before it ships, and then listed here with where the limit lives (docs/DEPLOYMENT.md).
 */

const ROOT = path.resolve(__dirname, '../../..');

/** Dynamic server code that is allowed because it is rate-limited. Path, then where. */
const RATE_LIMITED: Record<string, string> = {
  'src/app/api/assistant/route.ts': 'src/adapters/assistant/server/rate-limit.ts, reply',
  'src/app/api/assistant/local/route.ts': 'src/adapters/assistant/server/rate-limit.ts, reply',
  'src/app/api/assistant/bridge/route.ts': 'src/adapters/assistant/server/rate-limit.ts, bridge',
  'src/app/api/mcp/route.ts': 'src/adapters/assistant/server/rate-limit.ts, mcp',
};

function filesUnder(relative: string): string[] {
  return readdirSync(path.join(ROOT, relative), { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(relative, entry.name);
    return entry.isDirectory() ? filesUnder(child) : [child];
  });
}

const source = filesUnder('src').filter((file) => /\.tsx?$/.test(file));
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');

describe('public surface', () => {
  it('has no per-request route handler without a rate limit', () => {
    const dynamicRoutes = source
      .filter((file) => file.startsWith('src/app/') && /\/route\.tsx?$/.test(file))
      .filter((file) => !/export const dynamic = 'force-static'/.test(read(file)))
      .filter((file) => !(file in RATE_LIMITED));
    expect(dynamicRoutes).toEqual([]);
  });

  it('really limits every listed route', () => {
    for (const file of Object.keys(RATE_LIMITED)) expect(read(file)).toMatch(/\blimited\(request/);
  });

  it('has no server action without a rate limit', () => {
    const actions = source
      .filter((file) => /^\s*['"]use server['"]/m.test(read(file)))
      .filter((file) => !(file in RATE_LIMITED));
    expect(actions).toEqual([]);
  });
});
