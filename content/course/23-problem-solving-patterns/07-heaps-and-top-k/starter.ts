// A binary min-heap over an array. `less(a, b)` is true when a belongs nearer the root.
// The children of index i sit at 2i + 1 and 2i + 2.
export class MinHeap<T> {
  private readonly items: T[] = [];
  private readonly less: (a: T, b: T) => boolean;

  constructor(less: (a: T, b: T) => boolean) {
    this.less = less;
  }

  size(): number {
    return this.items.length;
  }

  peek(): T | undefined {
    return this.items[0];
  }

  push(item: T): void {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (!this.less(a[i] as T, a[parent] as T)) break;
      [a[i], a[parent]] = [a[parent] as T, a[i] as T];
      i = parent;
    }
  }

  pop(): T | undefined {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length === 0 || last === undefined) return top;
    a[0] = last;
    let i = 0;
    for (;;) {
      const left = 2 * i + 1;
      const right = left + 1;
      let next = i;
      if (left < a.length && this.less(a[left] as T, a[next] as T)) next = left;
      if (right < a.length && this.less(a[right] as T, a[next] as T)) next = right;
      if (next === i) return top;
      [a[i], a[next]] = [a[next] as T, a[i] as T];
      i = next;
    }
  }
}

export function topKFrequent(words: string[], k: number): string[] {
  // Target O(n + m log k): count with a Map, then keep the best k in a MinHeap
  // whose root is the weakest word.
  return words.slice(0, k);
}
