import { useState } from 'react';

type Item = { id: string; name: string; packed: boolean };

export function PackingList({ items }: { items: Item[] }) {
  const [list, setList] = useState(items);
  const packedCount = list.filter((item) => item.packed).length;

  function toggle(id: string) {
    // A new array, and a new object for the one item that changes. The rest are shared, untouched.
    setList(list.map((item) => (item.id === id ? { ...item, packed: !item.packed } : item)));
  }

  function remove(id: string) {
    setList(list.filter((item) => item.id !== id));
  }

  function add() {
    setList([...list, { id: `extra-${list.length}`, name: 'Sun cream', packed: false }]);
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
