export type Loader<T> = (key: string) => Promise<T>;

export function coalesce<T>(load: Loader<T>): Loader<T> {
  const inFlight = new Map<string, Promise<T>>();
  return (key) => {
    const waiting = inFlight.get(key);
    if (waiting) return waiting;
    const loading = load(key).finally(() => inFlight.delete(key));
    inFlight.set(key, loading);
    return loading;
  };
}
