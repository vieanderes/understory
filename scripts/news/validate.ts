/**
 * `tsx scripts/news/validate.ts`: checks every file under data/news against the schema.
 * The workflow runs it between the pipeline and the commit, so a bad file never lands on
 * the default branch. Exits 1 and names each bad file.
 */
import path from 'node:path';
import { FileNewsStore } from '@/adapters/news-file';

async function check(problems: string[], read: () => Promise<string | null>): Promise<void> {
  try {
    const problem = await read();
    if (problem !== null) problems.push(problem);
  } catch (error) {
    // The store throws with the file name and the first schema issue.
    problems.push(error instanceof Error ? error.message : String(error));
  }
}

export async function validateNewsData(root: string): Promise<string[]> {
  const store = new FileNewsStore(root);
  const problems: string[] = [];

  for (const date of await store.listDates()) {
    await check(problems, async () => {
      const day = await store.day(date);
      if (day === null) return `${date}: listed in index.json but the file is missing.`;
      return day.date === date ? null : `${date}: the file says it is ${day.date}.`;
    });
  }
  for (const period of ['week', 'month'] as const) {
    for (const key of await store.listDigestKeys(period)) {
      await check(problems, async () => {
        const digest = await store.digest(period, key);
        return digest === null || digest.key === key
          ? null
          : `${key}: the file says it is ${digest.key}.`;
      });
    }
  }
  return problems;
}

const isEntryPoint =
  process.argv[1] !== undefined && import.meta.filename === path.resolve(process.argv[1]);

if (isEntryPoint) {
  const root = process.env.NEWS_DATA_DIR ?? path.join(process.cwd(), 'data', 'news');
  validateNewsData(root)
    .then((problems) => {
      for (const problem of problems) console.error(problem);
      if (problems.length > 0) process.exitCode = 1;
      else console.log('data/news is valid.');
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
