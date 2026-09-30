export interface Req {
  method: string;
  path: string;
  body: string;
}

export interface Res {
  status: number;
  body: string;
}

// Plays the part of Response.json: a status and a JSON body.
function json(status: number, data: unknown): Res {
  return { status, body: JSON.stringify(data) };
}

interface Todo {
  id: number;
  title: string;
  done: boolean;
}

const todos: Todo[] = [{ id: 1, title: 'Buy milk', done: false }];
let nextId = 2;

export function handle(request: Req): Res {
  if (request.method === 'GET' && request.path === '/todos') {
    return json(200, todos);
  }
  if (request.method === 'POST' && request.path === '/todos') {
    const data = JSON.parse(request.body);
    const todo = { id: nextId, title: data.title, done: false };
    nextId = nextId + 1;
    todos.push(todo);
    return json(201, todo);
  }
  if (request.method === 'GET' && request.path.startsWith('/todos/')) {
    const id = Number(request.path.slice('/todos/'.length));
    const todo = todos.find((t) => t.id === id);
    if (todo) return json(200, todo);
  }
  return json(404, { error: 'Not found' });
}
