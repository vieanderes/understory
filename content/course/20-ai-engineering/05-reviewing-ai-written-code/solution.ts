export type Import = { name: string; from: string };

// A package name is the part before the first slash, except a scoped package keeps its scope.
function packageOf(from: string): string {
  const parts = from.split('/');
  if (from.startsWith('@') && parts.length > 1) return `${parts[0]}/${parts[1]}`;
  return parts[0] ?? from;
}

// Every package not on the allow-list is suspect: it may not exist at all.
export function unknownImports(imports: Import[], allowed: string[]): string[] {
  const found: string[] = [];
  for (const line of imports) {
    const isPackage = !line.from.startsWith('.') && !line.from.startsWith('node:');
    if (isPackage) {
      const pkg = packageOf(line.from);
      if (!allowed.includes(pkg) && !found.includes(pkg)) found.push(pkg);
    }
  }
  return found.sort();
}
