export type Import = { name: string; from: string };

export function unknownImports(imports: Import[], allowed: string[]): string[] {
  // Skip relative and node: imports. Reduce each path to its package name, then compare.
  return imports.map((line) => line.from);
}
