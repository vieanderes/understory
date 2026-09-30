/**
 * The Python packages a challenge may import beyond the standard library, and how a run
 * finds out which it needs (docs/SANDBOX.md, "Packages").
 *
 * Three, chosen for the AI chapters: pydantic to validate model replies, numpy for
 * embeddings, pandas for eval tables. Each one is several megabytes of WebAssembly, so a
 * run loads only what its code and tests import, on the first run that needs it.
 *
 * The wheels come from the Pyodide distribution the repository pins. Its lock file names
 * every wheel with its dependencies and SHA-256, so `packageFiles` reads the lock rather
 * than repeating it, and an upgrade of `pyodide` brings the matching wheels with it.
 */

export const PYTHON_PACKAGES = ['numpy', 'pandas', 'pydantic'] as const;
export type PythonPackage = (typeof PYTHON_PACKAGES)[number];

const SUPPORTED: ReadonlySet<string> = new Set(PYTHON_PACKAGES);

export function isPythonPackage(name: string): name is PythonPackage {
  return SUPPORTED.has(name);
}

/** A module name that belongs to a supported package without being its own name. */
const PROVIDED_BY: Readonly<Record<string, PythonPackage>> = { pydantic_core: 'pydantic' };

function packageOfModule(module: string): PythonPackage | null {
  const top = module.split('.')[0] ?? '';
  if (isPythonPackage(top)) return top;
  return PROVIDED_BY[top] ?? null;
}

const IMPORT_LINE = /^[ \t]*import[ \t]+([^#\n]+)/gm;
const FROM_LINE = /^[ \t]*from[ \t]+([A-Za-z_][\w.]*)[ \t]+import\b/gm;

/**
 * The supported packages that the sources import, sorted. Reads `import x`, `import x as
 * y`, `import a, x.sub` and `from x.sub import y` at the start of a line, indented or
 * not. It is a scan, not a parser: an import inside a triple-quoted string counts too,
 * which only loads a package early, and `__import__("numpy")` is not seen, which fails
 * with Python's own ModuleNotFoundError.
 */
export function importedPythonPackages(...sources: readonly string[]): PythonPackage[] {
  const found = new Set<PythonPackage>();
  for (const source of sources) {
    for (const match of source.matchAll(IMPORT_LINE)) {
      for (const part of (match[1] ?? '').split(',')) {
        const name = part.trim().split(/\s+/)[0] ?? '';
        const pkg = packageOfModule(name);
        if (pkg) found.add(pkg);
      }
    }
    for (const match of source.matchAll(FROM_LINE)) {
      const pkg = packageOfModule(match[1] ?? '');
      if (pkg) found.add(pkg);
    }
  }
  return PYTHON_PACKAGES.filter((name) => found.has(name));
}

/** The part of pyodide-lock.json this module reads. */
export interface PyodideLock {
  packages: Record<string, { name: string; file_name: string; depends: string[]; sha256: string }>;
}

export interface PackageFile {
  /** The lock's key, normalised as pip does: lower case, runs of `-_.` as one `-`. */
  name: string;
  fileName: string;
  sha256: string;
}

const normalise = (name: string): string => name.toLowerCase().replace(/[-_.]+/g, '-');

/**
 * Every wheel the named packages need, dependencies before the packages that use them,
 * each once. Throws for a name the lock does not know: a typo must not ship quietly.
 */
export function packageFiles(lock: PyodideLock, names: readonly string[]): PackageFile[] {
  const byName = new Map<string, PyodideLock['packages'][string]>();
  for (const [key, entry] of Object.entries(lock.packages)) byName.set(normalise(key), entry);

  const ordered: PackageFile[] = [];
  const seen = new Set<string>();
  const visit = (raw: string): void => {
    const name = normalise(raw);
    if (seen.has(name)) return;
    seen.add(name);
    const entry = byName.get(name);
    if (!entry) throw new Error(`The Pyodide lock file has no package "${raw}".`);
    for (const dependency of entry.depends) visit(dependency);
    ordered.push({ name, fileName: entry.file_name, sha256: entry.sha256 });
  };
  for (const name of names) visit(name);
  return ordered;
}

/** "Loading numpy…", "Loading Python and numpy…", "Loading numpy, pandas and pydantic…". */
export function loadingLabel(what: readonly string[]): string {
  const last = what[what.length - 1] ?? '';
  const list = what.length < 2 ? last : `${what.slice(0, -1).join(', ')} and ${last}`;
  return `Loading ${list}…`;
}
