export function corsHeaders(origin: string, allowed: string[]): Record<string, string> {
  // Replace this. It lets any origin that starts like a trusted one read the reply.
  if (allowed.some((trusted) => origin.startsWith(trusted))) {
    return { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
  }
  return {};
}
