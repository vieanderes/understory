import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildServiceWorker,
  composeBuildId,
  listBuildAssets,
  readBuildInputs,
} from '../../../../scripts/build-sw';

/*
 * scripts/build-sw.ts. The build id and the file list are injected at bundle time, and
 * nothing else makes a browser install a new worker, so the injection is worth a test of
 * its own: a change to either has to change the bytes of public/sw.js.
 */

let root: string;
const DIST = '.next-test';

async function put(file: string, body: string): Promise<void> {
  const full = path.join(root, file);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, body);
}

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'understory-sw-'));
  await put('public/content/v1/manifest.json', JSON.stringify({ contentRev: 'd645ba30841f' }));
  await put(`${DIST}/BUILD_ID`, 'HxZ9k2QpL\n');
  await put(`${DIST}/static/chunks/main-8f3a.js`, 'console.log(1)');
  await put(`${DIST}/static/chunks/main-8f3a.js.map`, '{}');
  await put(`${DIST}/static/css/app 1c2d.css`, 'body{}');
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('composeBuildId', () => {
  it('joins the content revision to a short hash of the Next build id', () => {
    const id = composeBuildId({ contentRev: 'd645ba30841f', nextBuildId: 'HxZ9k2QpL' });
    expect(id).toMatch(/^d645ba30841f-[0-9a-f]{10}$/);
  });

  it('is deterministic, and ignores the trailing newline of the file', () => {
    const inputs = { contentRev: 'r1', nextBuildId: 'HxZ9k2QpL' };
    expect(composeBuildId(inputs)).toBe(composeBuildId({ ...inputs, nextBuildId: 'HxZ9k2QpL\n' }));
  });

  it('changes when either input changes, which is what installs a new worker', () => {
    const base = composeBuildId({ contentRev: 'r1', nextBuildId: 'a' });
    expect(composeBuildId({ contentRev: 'r2', nextBuildId: 'a' })).not.toBe(base);
    expect(composeBuildId({ contentRev: 'r1', nextBuildId: 'b' })).not.toBe(base);
  });

  it('says so when there is no content build and no Next build', () => {
    expect(composeBuildId({ contentRev: null, nextBuildId: null })).toBe('nocontent-nobuild');
    expect(composeBuildId({ contentRev: 'r1', nextBuildId: null })).toBe('r1-nobuild');
  });
});

describe('readBuildInputs', () => {
  it('reads the content revision and the Next build id', async () => {
    expect(await readBuildInputs(root, DIST)).toEqual({
      contentRev: 'd645ba30841f',
      nextBuildId: 'HxZ9k2QpL\n',
    });
  });

  it('returns nulls before the first build rather than throwing', async () => {
    const empty = await mkdtemp(path.join(tmpdir(), 'understory-sw-empty-'));
    expect(await readBuildInputs(empty, DIST)).toEqual({ contentRev: null, nextBuildId: null });
    await rm(empty, { recursive: true, force: true });
  });
});

describe('listBuildAssets', () => {
  it('lists every build file as a URL, sorted, with source maps left out', async () => {
    expect(await listBuildAssets(root, DIST)).toEqual([
      '/_next/static/chunks/main-8f3a.js',
      '/_next/static/css/app%201c2d.css',
    ]);
  });

  it('is empty when the build has no static directory', async () => {
    expect(await listBuildAssets(root, 'nowhere')).toEqual([]);
  });
});

describe('buildServiceWorker', () => {
  it('injects the build id and the file list into the bundle', async () => {
    const { buildId, assets, code } = await buildServiceWorker({ root, distDir: DIST });

    expect(buildId).toMatch(/^d645ba30841f-[0-9a-f]{10}$/);
    expect(assets).toContain('/_next/static/chunks/main-8f3a.js');

    // The placeholders are gone: what ships is the literal value.
    expect(code).not.toContain('__SW_BUILD_ID__');
    expect(code).not.toContain('__SW_ASSETS__');
    expect(code).toContain(JSON.stringify(buildId));
    expect(code).toContain('/_next/static/chunks/main-8f3a.js');
    expect(code).not.toContain('/_next/static/chunks/main-8f3a.js.map');
  });

  it('bundles the worker as one self-contained script with no imports left', async () => {
    const { code } = await buildServiceWorker({ root, distDir: DIST, buildId: 'test-1' });
    expect(code.startsWith('"use strict";(()=>{')).toBe(true);
    expect(code).not.toMatch(/(^|\s)import\s/);
    expect(code).toContain('understory-static-v1');
    expect(code).toContain('/offline');
  });

  it('changes its bytes when the build id changes, so the browser installs it', async () => {
    const first = await buildServiceWorker({ root, distDir: DIST, buildId: 'test-1' });
    const second = await buildServiceWorker({ root, distDir: DIST, buildId: 'test-2' });
    expect(first.code).not.toBe(second.code);
  });
});
