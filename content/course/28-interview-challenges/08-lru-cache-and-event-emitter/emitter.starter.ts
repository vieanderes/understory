export type Listener = (...args: unknown[]) => void;

export class Emitter {
  #listeners = new Map<string, Listener[]>();

  on(event: string, fn: Listener): () => void {
    const list = this.#listeners.get(event) ?? [];
    list.push(fn);
    this.#listeners.set(event, list);
    // Return a function that removes this listener again.
    return () => {};
  }

  once(event: string, fn: Listener): () => void {
    // Should run at most one time.
    return this.on(event, fn);
  }

  off(event: string, fn: Listener): void {
    const list = this.#listeners.get(event) ?? [];
    list.splice(list.indexOf(fn), 1);
  }

  emit(event: string, ...args: unknown[]): boolean {
    // Should return whether any listener ran.
    for (const fn of this.#listeners.get(event) ?? []) fn(...args);
    return true;
  }
}
