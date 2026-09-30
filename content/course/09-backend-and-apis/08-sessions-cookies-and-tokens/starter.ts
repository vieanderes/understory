export interface Req {
  method: string;
  path: string;
  headers?: Record<string, string>;
  body: string;
}

export interface Res {
  status: number;
  headers?: Record<string, string>;
  body: string;
}

function json(status: number, data: unknown): Res {
  return { status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
}

// Stands in for a real password check. The security chapter shows how passwords are stored.
function checkPassword(user: string, password: string): boolean {
  return password === `${user}-secret`;
}

// Session id -> the user it belongs to.
const sessions = new Map<string, string>();

// POST /login. newId() returns a long random id.
export function login(request: Req, newId: () => string): Res {
  const { user, password } = JSON.parse(request.body);
  if (!checkPassword(user, password)) return json(401, { error: 'Wrong name or password' });
  return { status: 204, headers: { 'Set-Cookie': `user=${user}` }, body: '' };
}

// GET /me
export function me(request: Req): Res {
  const cookie = request.headers?.['Cookie'] ?? '';
  const user = cookie.replace('user=', '');
  return json(200, { user });
}
