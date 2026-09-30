import { useState } from 'react';

type Task = { id: string; title: string };

function TaskRow({ title, onRemove }: { title: string; onRemove: () => void }) {
  const [done, setDone] = useState(false);
  const [note, setNote] = useState('');
  return (
    <li>
      <label>
        <input type="checkbox" checked={done} onChange={() => setDone(!done)} />
        {title}
      </label>
      <input aria-label={`Note for ${title}`} value={note} onChange={(event) => setNote(event.target.value)} />
      <button aria-label={`Remove ${title}`} onClick={onRemove}>
        Remove
      </button>
    </li>
  );
}

export function TaskList({ tasks }: { tasks: Task[] }) {
  const [items, setItems] = useState(tasks);
  return (
    <div>
      <button onClick={() => setItems(items.toReversed())}>Reverse</button>
      <ul>
        {items.map((task) => (
          // The id travels with the task, so its row, and the row's state, travel too.
          <TaskRow
            key={task.id}
            title={task.title}
            onRemove={() => setItems(items.filter((item) => item.id !== task.id))}
          />
        ))}
      </ul>
    </div>
  );
}
