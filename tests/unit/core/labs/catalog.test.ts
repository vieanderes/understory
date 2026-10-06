import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LAB_INFO, LAB_INFO_BY_ID } from '@/core/labs/catalog';

describe('lab catalogue', () => {
  it('lists every lab engine in src/core/labs, once', () => {
    const engines = fs
      .readdirSync(path.join(process.cwd(), 'src/core/labs'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(LAB_INFO.map((lab) => lab.id).sort()).toEqual(engines);
    expect(LAB_INFO_BY_ID.size).toBe(LAB_INFO.length);
  });
});
