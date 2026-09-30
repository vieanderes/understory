export interface IncomingRequest {
  ip: string;
  headers: Record<string, string | undefined>;
}

export function canReadAllOrders(req: IncomingRequest, serviceTokens: string[]): boolean {
  // Replace this. Anyone who reaches the private network gets every order.
  return req.ip.startsWith('10.');
}
