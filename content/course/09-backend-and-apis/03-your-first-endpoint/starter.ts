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
  // Add POST /todos here, then GET /todos/:id.

  return json(404, { error: 'Not found' });
}
