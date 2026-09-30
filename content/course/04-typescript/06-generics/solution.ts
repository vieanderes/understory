/**
 * Groups items by the value of one property. `K` is the property name, and `T[K]` is the
 * type of that property, so the keys of the Map have the property's own type.
 *
 * Items keep their input order inside each group, and groups appear in first-seen order.
 */
export function groupBy<T, K extends keyof T>(items: readonly T[], key: K): Map<T[K], T[]> {
  const groups = new Map<T[K], T[]>();
  for (const item of items) {
    const value = item[key];
    const group = groups.get(value);
    if (group === undefined) {
      groups.set(value, [item]);
    } else {
      group.push(item);
    }
  }
  return groups;
}
