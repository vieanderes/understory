export type Listener = (...args: unknown[]) => void;

// Each registration is its own object, so removing one never touches another that
// happens to hold the same function.
interface Entry {
  fn: Listener;
  once: boolean;
}

export class Emitter {
  #listeners = new Map<string, Entry[]>();

  on(event: string, fn: Listener): () => void {
    return this.#add(event, { fn, once: false });
  }

  once(event: string, fn: Listener): () => void {
    return this.#add(event, { fn, once: true });
  }

  off(event: string, fn: Listener): void {
    const list = this.#listeners.get(event) ?? [];
    const index = list.findIndex((entry) => entry.fn === fn);
    if (index !== -1) list.splice(index, 1);
  }

  emit(event: string, ...args: unknown[]): boolean {
    const list = this.#listeners.get(event) ?? [];
    if (list.length === 0) return false;
    // A copy: listeners that remove or add others mid-emit can't make the loop skip one.
    for (const entry of [...list]) {
      if (entry.once) this.#remove(event, entry);
      entry.fn(...args);
    }
    return true;
  }

  #add(event: string, entry: Entry): () => void {
    const list = this.#listeners.get(event) ?? [];
    list.push(entry);
    this.#listeners.set(event, list);
    return () => this.#remove(event, entry);
  }

  #remove(event: string, entry: Entry): void {
    const list = this.#listeners.get(event) ?? [];
    const index = list.indexOf(entry);
    if (index !== -1) list.splice(index, 1);
  }
}
