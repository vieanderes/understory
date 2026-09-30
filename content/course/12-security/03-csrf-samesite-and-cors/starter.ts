const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

export function csrfOk(method: string, formToken: string | undefined, sessionToken: string | undefined): boolean {
  if (SAFE_METHODS.includes(method)) return true;
  // Replace this. It lets every request through, so another site's form works.
  return true;
}
