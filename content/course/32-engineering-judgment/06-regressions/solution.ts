// Each key is a file. Its list names the files it imports.
export type ImportGraph = Record<string, string[]>;

export function testsToRun(imports: ImportGraph, changed: string[]): string[] {
  // Turn the graph round: for each file, who imports it.
  const importedBy = new Map<string, string[]>();
  for (const [file, deps] of Object.entries(imports)) {
    for (const dep of deps) {
      importedBy.set(dep, [...(importedBy.get(dep) ?? []), file]);
    }
  }
  // Walk outwards from the change. The set stops a cycle from looping for ever.
  const affected = new Set(changed);
  const queue = [...changed];
  for (const file of queue) {
    for (const parent of importedBy.get(file) ?? []) {
      if (!affected.has(parent)) {
        affected.add(parent);
        queue.push(parent);
      }
    }
  }
  return [...affected].filter((file) => file.endsWith('.test.ts')).sort();
}
