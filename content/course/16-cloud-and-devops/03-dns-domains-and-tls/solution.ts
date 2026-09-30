// A certificate covers a host when one of its names matches.
// A wildcard stands for exactly one label: *.example.com covers www.example.com,
// but not example.com and not a.b.example.com.
export function coversName(names: string[], host: string): boolean {
  const wanted = host.toLowerCase();
  for (const raw of names) {
    const name = raw.toLowerCase();
    if (name === wanted) return true;
    if (name.startsWith('*.')) {
      const suffix = name.slice(1);
      if (wanted.endsWith(suffix)) {
        const label = wanted.slice(0, wanted.length - suffix.length);
        if (label.length > 0 && !label.includes('.')) return true;
      }
    }
  }
  return false;
}
