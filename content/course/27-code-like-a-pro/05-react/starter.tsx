import { useEffect, useState } from 'react';

export type Todo = { id: number; title: string; done: boolean };

export function TodoList({ todos }: { todos: Todo[] }) {
  const [query, setQuery] = useState('');
  const [hideDone, setHideDone] = useState(false);
  const [visible, setVisible] = useState(todos);

  useEffect(() => {
    setVisible(
      todos.filter((todo) => {
        if (hideDone && todo.done) return false;
        return todo.title.toLowerCase().includes(query.toLowerCase());
      }),
    );
  }, [query]);

  return (
    <div>
      <label>
        Search
        <input value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <label>
        <input
          type="checkbox"
          checked={hideDone}
          onChange={(event) => setHideDone(event.target.checked)}
        />
        Hide done
      </label>
      <ul>
        {visible.map((todo) => (
          <li key={todo.id}>{todo.title}</li>
        ))}
      </ul>
    </div>
  );
}
