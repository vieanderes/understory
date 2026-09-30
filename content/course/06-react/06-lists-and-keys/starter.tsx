import { useState } from 'react';

type Task = { id: string; title: string };

function TaskRow({ title }: { title: string }) {
  const [done, setDone] = useState(false);
  const [note, setNote] = useState('');
  return (
    <li>
      <label>
        <input type="checkbox" checked={done} onChange={() => setDone(!done)} />
        {title}
      </label>
      <input aria-label={`Note for ${title}`} value={note} onChange={(event) => setNote(event.target.value)} />
    </li>
  );
}

// Ticks and notes jump to the wrong task after Reverse. Fix that, then add a Remove button to each row.
export function TaskList({ tasks }: { tasks: Task[] }) {
  const [items, setItems] = useState(tasks);
  return (
    <div>
      <button onClick={() => setItems(items.toReversed())}>Reverse</button>
      <ul>
        {items.map((task, index) => (
          <TaskRow key={index} title={task.title} />
        ))}
      </ul>
    </div>
  );
}
