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
  // Replace this. It ignores every action, so nothing ever changes.
  return state;
}
