import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  fetchPythonAssets,
  fetchPythonPackages,
  PYODIDE_BASE_URL,
  PYODIDE_VERSION,
} from '@/adapters/pyodide/assets';

const LOCK = JSON.stringify({
  packages: {
    numpy: { name: 'numpy', file_name: 'numpy.whl', depends: [], sha256: 'a' },
    pandas: { name: 'pandas', file_name: 'pandas.whl', depends: ['numpy', 'six'], sha256: 'b' },
    six: { name: 'six', file_name: 'six.whl', depends: [], sha256: 'c' },
  },
});

function serve(asked: string[], missing = '') {
  return (url: string) => {
    asked.push(url);
    const body = url.endsWith('pyodide-lock.json') ? LOCK : url;
    return Promise.resolve({
      ok: !url.endsWith(missing) || missing === '',
      status: url.endsWith(missing) && missing !== '' ? 404 : 200,
      arrayBuffer: () => Promise.resolve(new TextEncoder().encode(body).buffer as ArrayBuffer),
    });
  };
}

describe('Pyodide assets', () => {
  it('names the installed version, so the URL and the bytes agree', () => {
    const require = createRequire(path.join(process.cwd(), 'package.json'));
    const pkg = require('pyodide/package.json') as { version: string };
    expect(PYODIDE_VERSION).toBe(pkg.version);
    expect(PYODIDE_BASE_URL).toBe(`/pyodide/${pkg.version}/`);
  });

  it('fetches the five files from the versioned folder', async () => {
    const asked: string[] = [];
    const assets = await fetchPythonAssets((url) => {
      asked.push(url);
      return Promise.resolve({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(new TextEncoder().encode(url).buffer as ArrayBuffer),
      });
    });
    expect(asked.sort()).toEqual(
      [
        'pyodide-lock.json',
        'pyodide.asm.js',
        'pyodide.asm.wasm',
        'pyodide.js',
        'python_stdlib.zip',
      ].map((name) => `${PYODIDE_BASE_URL}${name}`),
    );
    expect(new TextDecoder().decode(assets.wasm)).toBe(`${PYODIDE_BASE_URL}pyodide.asm.wasm`);
    expect(assets.version).toBe(PYODIDE_VERSION);
  });

  it('fails with the status when a file is missing', async () => {
    await expect(
      fetchPythonAssets(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        }),
      ),
    ).rejects.toThrow('Python could not be loaded (404).');
  });
});

describe('package wheels', () => {
  it('fetches every wheel a package needs from the versioned folder, by file name', async () => {
    const asked: string[] = [];
    const files = await fetchPythonPackages(['pandas'], new Set(), serve(asked));
    expect(Object.keys(files).sort()).toEqual(['numpy.whl', 'pandas.whl', 'six.whl']);
    expect(asked).toContain(`${PYODIDE_BASE_URL}pandas.whl`);
    expect(new TextDecoder().decode(files['six.whl'])).toBe(`${PYODIDE_BASE_URL}six.whl`);
  });

  it('skips the wheels the frame already holds', async () => {
    const asked: string[] = [];
    const files = await fetchPythonPackages(['pandas'], new Set(['numpy.whl']), serve(asked));
    expect(Object.keys(files).sort()).toEqual(['pandas.whl', 'six.whl']);
    expect(asked).not.toContain(`${PYODIDE_BASE_URL}numpy.whl`);
  });

  it('names the package when a wheel is missing', async () => {
    await expect(fetchPythonPackages(['pandas'], new Set(), serve([], 'six.whl'))).rejects.toThrow(
      'pandas could not be loaded (404).',
    );
  });
});
