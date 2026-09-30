import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Doc } from './contracts';

const DOCS_DIR = path.join(import.meta.dirname, 'docs');

/** The help articles, id = file name without .md, sorted so runs are reproducible. */
export function loadDocs(dir = DOCS_DIR): Doc[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) => ({
      id: name.replace(/\.md$/, ''),
      markdown: readFileSync(path.join(dir, name), 'utf8'),
    }));
}
