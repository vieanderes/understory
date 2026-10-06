import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';

/*
 * The feed list as a reader sees it: names in the groups the file is laid out in. The
 * groups are comment rules in content/feeds.yaml ("# --- Web platform ---"), so the file
 * stays the one place a feed is added and this list cannot drift from what is fetched.
 */

export interface SourceGroup {
  name: string;
  sources: string[];
}

const GROUP_RULE = /^\s*#\s*-{3}\s*(.+?)\s*-{3,}\s*$/;
const NAME_LINE = /^\s+name:\s*(.+?)\s*$/;

export function sourceGroupsOf(yamlText: string): SourceGroup[] {
  const groups: SourceGroup[] = [];
  for (const line of yamlText.split('\n')) {
    const rule = GROUP_RULE.exec(line);
    if (rule?.[1]) {
      groups.push({ name: rule[1], sources: [] });
      continue;
    }
    const name = NAME_LINE.exec(line)?.[1];
    if (name === undefined) continue;
    // Let the YAML parser undo any quoting, such as "Lil'Log (Lilian Weng)".
    const value = String(parse(name));
    const group = groups.at(-1) ?? { name: 'Feeds', sources: [] };
    if (groups.length === 0) groups.push(group);
    group.sources.push(value);
  }
  return groups.filter((group) => group.sources.length > 0);
}

let cache: Promise<SourceGroup[]> | null = null;

export function getSourceGroups(): Promise<SourceGroup[]> {
  cache ??= readFile(path.join(process.cwd(), 'content', 'feeds.yaml'), 'utf8').then(
    sourceGroupsOf,
  );
  return cache;
}
