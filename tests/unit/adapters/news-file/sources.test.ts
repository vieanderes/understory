import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { sourceGroupsOf } from '@/lib/news/sources';

describe('sourceGroupsOf', () => {
  it('names every feed of content/feeds.yaml once, in the groups the file draws', () => {
    const text = readFileSync(path.resolve(__dirname, '../../../../content/feeds.yaml'), 'utf8');
    const feeds = (parse(text) as { feeds: { name: string }[] }).feeds.map((f) => f.name);
    const groups = sourceGroupsOf(text);
    expect(groups.flatMap((g) => g.sources)).toEqual(feeds);
    expect(groups.length).toBeGreaterThan(1);
    expect(groups.map((g) => g.name)).toContain('Web platform');
  });

  it('keeps feeds listed before any group rule', () => {
    expect(sourceGroupsOf("feeds:\n  - id: a\n    name: 'A'\n")).toEqual([
      { name: 'Feeds', sources: ['A'] },
    ]);
  });
});
