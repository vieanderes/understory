export interface Req {
  method: string;
  path: string;
  body: string;
}

export interface Res {
  status: number;
  headers: Record<string, string>;
  body: string;
}

// Plays the part of Response.json, with extra headers if you pass them.
function json(status: number, data: unknown, headers: Record<string, string> = {}): Res {
  return { status, headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data) };
}

// A response with a status, headers and no body at all.
function empty(status: number, headers: Record<string, string> = {}): Res {
  return { status, headers, body: '' };
}

const books = new Map([[1, { id: 1, title: 'Emma' }]]);
let nextId = 2;

export function handle(request: Req): Res {
  if (request.path === '/books') {
    if (request.method === 'GET') return json(200, [...books.values()]);
    if (request.method === 'POST') {
      const data = JSON.parse(request.body);
      const book = { id: nextId, title: data.title };
      nextId = nextId + 1;
      books.set(book.id, book);
      return json(201, book, { Location: `/books/${book.id}` });
    }
    return empty(405, { Allow: 'GET, POST' });
  }
  if (request.path.startsWith('/books/')) {
    const id = Number(request.path.slice('/books/'.length));
    if (request.method === 'DELETE') {
      if (books.delete(id)) return empty(204);
      return json(404, { error: 'Not found' });
    }
  }
  return json(404, { error: 'Not found' });
}
