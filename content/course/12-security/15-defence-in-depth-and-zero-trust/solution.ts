export interface IncomingRequest {
  ip: string;
  headers: Record<string, string | undefined>;
}

export function canReadAllOrders(req: IncomingRequest, serviceTokens: string[]): boolean {
  const header = req.headers['authorization'] ?? '';
  if (!header.startsWith('Bearer ')) return false;
  const token = header.slice('Bearer '.length);
  return token !== '' && serviceTokens.includes(token);
}
