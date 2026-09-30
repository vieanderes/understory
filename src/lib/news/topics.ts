import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';

/** Topic id to reader-facing label, from content/interests.yaml. Read once per build. */
let cache: Promise<Map<string, string>> | null = null;

async function load(): Promise<Map<string, string>> {
  const file = path.join(process.cwd(), 'content', 'interests.yaml');
  const data = parse(await readFile(file, 'utf8')) as {
    topics?: { id?: unknown; label?: unknown }[];
  };
  const labels = new Map<string, string>();
  for (const topic of data.topics ?? []) {
    if (typeof topic.id === 'string' && typeof topic.label === 'string') {
      labels.set(topic.id, topic.label);
    }
  }
  return labels;
}

export function getTopicLabels(): Promise<Map<string, string>> {
  cache ??= load();
  return cache;
}
