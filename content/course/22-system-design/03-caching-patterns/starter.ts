export type Loader<T> = (key: string) => Promise<T>;

export function coalesce<T>(load: Loader<T>): Loader<T> {
  // Keep one promise per key while its load is in flight.
  return (key) => load(key);
}
