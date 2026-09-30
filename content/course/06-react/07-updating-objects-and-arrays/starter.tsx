import { useState } from 'react';

type Item = { id: string; name: string; packed: boolean };

// Every button changes the array or an item in place, so React sees no change. Make copies instead.
export function PackingList({ items }: { items: Item[] }) {
  const [list, setList] = useState(items);
  const packedCount = list.filter((item) => item.packed).length;

  function toggle(id: string) {
    const item = list.find((entry) => entry.id === id);
    if (item) item.packed = !item.packed;
    setList(list);
  }

  function remove(id: string) {
    const index = list.findIndex((entry) => entry.id === id);
    list.splice(index, 1);
    setList(list);
  }

  function add() {
    list.push({ id: `extra-${list.length}`, name: 'Sun cream', packed: false });
    setList(list);
  }

  return (
    <div>
      <p>
        {packedCount} of {list.length} packed
      </p>
      <ul>
        {list.map((item) => (
          <li key={item.id}>
            <label>
              <input type="checkbox" checked={item.packed} onChange={() => toggle(item.id)} />
              {item.name}
            </label>
            <button aria-label={`Remove ${item.name}`} onClick={() => remove(item.id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <button onClick={add}>Add sun cream</button>
    </div>
  );
}
