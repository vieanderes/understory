/**
 * The online-test simulator's index, read from the bundle on disk for server pages
 * (docs/ONLINE-TEST.md). Tasks themselves are fetched by the client from the same bundle,
 * so a page ships only the tasks of the test being sat.
 */
import fs from 'node:fs';
import path from 'node:path';
import { onlineTestIndexSchema, type OnlineTestIndex } from '@/core/online-test/schema';
import { ContentError, contentRoot } from './fs';

const INDEX = 'public/content/v1/online-tests/index.json';

let cache: { stamp: string; index: OnlineTestIndex } | undefined;

export async function getOnlineTestIndex(): Promise<OnlineTestIndex> {
  const file = path.join(contentRoot(), INDEX);
  if (!fs.existsSync(file)) {
    throw new ContentError(INDEX, 'This file is missing. Run "pnpm build:content" to rebuild the bundle.');
  }
  const stat = fs.statSync(file);
  const stamp = `${stat.mtimeMs}:${stat.size}`;
  if (cache?.stamp !== stamp) {
    const parsed = onlineTestIndexSchema.safeParse(JSON.parse(fs.readFileSync(file, 'utf8')));
    if (!parsed.success) throw new ContentError(INDEX, 'This file does not match the bundle schema.');
    cache = { stamp, index: parsed.data };
  }
  return cache.index;
}
