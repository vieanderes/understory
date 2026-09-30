/**
 * Content build. Run with `pnpm build:content`. It also runs before `dev` and `build`.
 *
 * Checks the content, then writes:
 *  - public/content/v1/   the static bundle the web and iOS clients fetch (git-ignored)
 *  - contracts/schemas/   JSON Schema for authoring files and for the bundle (committed)
 *
 * The build refuses to run on content with errors, because a broken lesson that reaches
 * the bundle is a broken lesson on a learner's phone. Warnings do not stop it.
 */
import path from 'node:path';
import { contentRoot } from '../src/lib/content/fs';
import { loadOutline } from '../src/lib/content/outline';
import { checkContent } from './lib/check';
import { compileCatalog, languagesOf, writeBundle } from './lib/compile';
import { writeJsonSchemas } from './lib/json-schema';
import { addPlacement } from './lib/placement';
import { addPracticeCatalog } from './lib/practice-catalog';
import { createRenderer } from './lib/render';
import { formatReport } from './lib/report';
import { writeOnlineTests } from './lib/online-tests';

const colour = process.stdout.isTTY === true && process.env.NO_COLOR === undefined;

async function main(): Promise<number> {
  const root = contentRoot();
  const { catalog, issues, checked } = await checkContent(root);
  const errors = issues.filter((issue) => issue.severity === 'error');
  if (errors.length > 0) {
    process.stdout.write(formatReport(errors, { colour, strict: false, checked }));
    console.log('build:content stopped. Nothing was written.');
    return 1;
  }

  const renderer = await createRenderer(languagesOf(catalog));
  const bundle = compileCatalog(catalog, renderer, loadOutline(root).outline?.data);
  addPracticeCatalog(bundle);
  await addPlacement(bundle, catalog, root);
  writeBundle(path.join(root, 'public/content/v1'), bundle);
  // After the lesson bundle, which clears its folder first. The references run here,
  // because every expected value of the simulator is what solution.ts returns.
  const online = await writeOnlineTests(root, path.join(root, 'public/content/v1'), renderer);
  const onlineErrors = online.issues.filter((issue) => issue.severity === 'error');
  if (onlineErrors.length > 0) {
    process.stdout.write(formatReport(onlineErrors, { colour, strict: false, checked }));
    console.log('build:content stopped at the online tests.');
    return 1;
  }
  const schemas = writeJsonSchemas(path.join(root, 'contracts/schemas'));

  const lessons = [...bundle.files.keys()].filter((name) => name.startsWith('lessons/')).length;
  console.log(
    `build:content: ${lessons} lessons, ${online.tasks} online-test tasks, revision ${bundle.manifest.contentRev}, ${schemas.length} schemas.`,
  );
  return 0;
}

// No top-level await: the repo is CommonJS by default, and tsx runs this file as such.
void main().then((code) => {
  process.exitCode = code;
});
