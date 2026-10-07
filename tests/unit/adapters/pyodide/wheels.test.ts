import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ensureWheels, wheelCacheDir, WHEEL_SOURCE } from '@/adapters/pyodide/wheels';

const made: string[] = [];
afterEach(async () => {
  for (const dir of made.splice(0)) await rm(dir, { recursive: true, force: true });
});

async function emptyDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'wheels-'));
  made.push(dir);
  return dir;
}

describe('ensureWheels', () => {
  it('refuses bytes that do not match the lock file, and keeps nothing', async () => {
    const dir = await emptyDir();
    const asked: string[] = [];
    const fetchFile = (url: string) => {
      asked.push(url);
      return Promise.resolve(new Response('not a wheel'));
    };
    await expect(ensureWheels(['numpy'], { dir, fetchFile })).rejects.toThrow(/SHA-256/);
    expect(asked).toEqual([
      `${WHEEL_SOURCE}numpy-2.2.5-cp313-cp313-pyemscripten_2025_0_wasm32.whl`,
    ]);
    expect(await readdir(dir)).toEqual([]);
  });

  it('says which file failed to download', async () => {
    const dir = await emptyDir();
    const fetchFile = () => Promise.resolve(new Response('', { status: 404 }));
    await expect(ensureWheels(['pydantic'], { dir, fetchFile })).rejects.toThrow(/\(404\)/);
  });

  it('asks the network for nothing once the cache holds the pinned bytes', async () => {
    // The Pyodide runner tests fill the real cache; this reads it back.
    const first = await ensureWheels(['pandas', 'pydantic']);
    expect(first.dir).toBe(wheelCacheDir());
    const again = await ensureWheels(['pandas', 'pydantic'], {
      fetchFile: () => Promise.reject(new Error('no network')),
    });
    expect(again.downloaded).toBe(0);
    expect(again.files.map((f) => f.name)).toContain('pydantic-core');
  }, 120_000);
});
