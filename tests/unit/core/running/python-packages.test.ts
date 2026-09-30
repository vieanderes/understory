import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  importedPythonPackages,
  isPythonPackage,
  loadingLabel,
  packageFiles,
  PYTHON_PACKAGES,
  type PyodideLock,
} from '@/core/running/python-packages';

const LOCK: PyodideLock = {
  packages: {
    numpy: { name: 'numpy', file_name: 'numpy-2.whl', depends: [], sha256: 'a1' },
    pandas: {
      name: 'pandas',
      file_name: 'pandas-2.whl',
      depends: ['numpy', 'python-dateutil', 'pytz'],
      sha256: 'b2',
    },
    'python-dateutil': {
      name: 'python-dateutil',
      file_name: 'dateutil.whl',
      depends: ['six'],
      sha256: 'c3',
    },
    six: { name: 'six', file_name: 'six.whl', depends: [], sha256: 'd4' },
    pytz: { name: 'pytz', file_name: 'pytz.whl', depends: [], sha256: 'e5' },
    pydantic: {
      name: 'pydantic',
      file_name: 'pydantic.whl',
      depends: ['pydantic_core'],
      sha256: 'f6',
    },
    'pydantic-core': { name: 'pydantic_core', file_name: 'core.whl', depends: [], sha256: 'g7' },
  },
};

describe('importedPythonPackages', () => {
  it('finds plain, aliased, dotted and from imports', () => {
    expect(importedPythonPackages('import numpy as np\n')).toEqual(['numpy']);
    expect(importedPythonPackages('from pandas import DataFrame\n')).toEqual(['pandas']);
    expect(importedPythonPackages('import numpy.linalg\n')).toEqual(['numpy']);
    expect(importedPythonPackages('from pydantic.fields import Field\n')).toEqual(['pydantic']);
  });

  it('reads a comma list and an indented import', () => {
    const source = 'import os, numpy as np, pandas\n\ndef f():\n    import pydantic\n';
    expect(importedPythonPackages(source)).toEqual(['numpy', 'pandas', 'pydantic']);
  });

  it('joins several sources, sorted and without repeats', () => {
    expect(importedPythonPackages('import pandas\n', 'import numpy\nimport pandas\n')).toEqual([
      'numpy',
      'pandas',
    ]);
  });

  it('ignores comments, relative imports, the standard library and look-alike names', () => {
    const source = [
      '# import numpy',
      'from . import pandas',
      'import numpyish',
      'import json, asyncio',
      'from pydantic_settings import BaseSettings',
      'x = "import pandas"',
    ].join('\n');
    expect(importedPythonPackages(source)).toEqual([]);
  });

  it('takes pydantic_core as pydantic, which brings it', () => {
    expect(importedPythonPackages('from pydantic_core import ValidationError\n')).toEqual([
      'pydantic',
    ]);
  });
});

describe('isPythonPackage', () => {
  it('accepts the supported names only', () => {
    for (const name of PYTHON_PACKAGES) expect(isPythonPackage(name)).toBe(true);
    expect(isPythonPackage('scipy')).toBe(false);
    expect(isPythonPackage('six')).toBe(false);
  });
});

describe('packageFiles', () => {
  it('lists every wheel a package needs, dependencies first, each once', () => {
    expect(packageFiles(LOCK, ['pandas']).map((f) => f.fileName)).toEqual([
      'numpy-2.whl',
      'six.whl',
      'dateutil.whl',
      'pytz.whl',
      'pandas-2.whl',
    ]);
    expect(packageFiles(LOCK, ['numpy', 'pandas']).map((f) => f.fileName)).toHaveLength(5);
  });

  it('normalises names as pip does, so pydantic_core finds pydantic-core', () => {
    expect(packageFiles(LOCK, ['pydantic'])).toEqual([
      { name: 'pydantic-core', fileName: 'core.whl', sha256: 'g7' },
      { name: 'pydantic', fileName: 'pydantic.whl', sha256: 'f6' },
    ]);
  });

  it('refuses a package the lock does not know', () => {
    expect(() => packageFiles(LOCK, ['scipy'])).toThrow(/scipy/);
  });

  it('resolves the real lock file for every supported package', () => {
    const file = path.join(process.cwd(), 'node_modules/pyodide/pyodide-lock.json');
    const lock = JSON.parse(readFileSync(file, 'utf8')) as PyodideLock;
    const names = packageFiles(lock, PYTHON_PACKAGES).map((f) => f.name);
    expect(names).toEqual(expect.arrayContaining(['numpy', 'pandas', 'pydantic', 'pydantic-core']));
    expect(names.indexOf('numpy')).toBeLessThan(names.indexOf('pandas'));
  });
});

describe('loadingLabel', () => {
  it('names what is loading in plain words', () => {
    expect(loadingLabel(['numpy'])).toBe('Loading numpy…');
    expect(loadingLabel(['Python', 'numpy'])).toBe('Loading Python and numpy…');
    expect(loadingLabel(['numpy', 'pandas', 'pydantic'])).toBe(
      'Loading numpy, pandas and pydantic…',
    );
  });
});
