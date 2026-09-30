const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

export function csrfOk(method: string, formToken: string | undefined, sessionToken: string | undefined): boolean {
  if (SAFE_METHODS.includes(method)) return true;
  if (!formToken || !sessionToken) return false;
  return formToken === sessionToken;
}
