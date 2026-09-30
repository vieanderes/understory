export interface Todo {
  id: number;
  text: string;
  done: boolean;
}

export interface TodoState {
  todos: Todo[];
  nextId: number;
}

export type TodoAction =
  | { type: 'add'; text: string }
  | { type: 'toggle'; id: number }
  | { type: 'remove'; id: number };

export function todoReducer(state: TodoState, action: TodoAction): TodoState {
  if (action.type === 'add') {
    const todo = { id: state.nextId, text: action.text, done: false };
    return { todos: [...state.todos, todo], nextId: state.nextId + 1 };
  }
  if (action.type === 'toggle') {
    const todos = state.todos.map((todo) =>
      todo.id === action.id ? { ...todo, done: !todo.done } : todo,
    );
    return { ...state, todos };
  }
  if (action.type === 'remove') {
    return { ...state, todos: state.todos.filter((todo) => todo.id !== action.id) };
  }
  return state;
}
