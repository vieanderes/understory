export function isAllowedUrl(url: string, allowedHosts: string[]): boolean {
  let rest: string;
  if (url.startsWith('https://')) rest = url.slice(8);
  else if (url.startsWith('http://')) rest = url.slice(7);
  else return false;

  const authority = rest.split('/')[0] ?? '';
  if (authority.includes('@')) return false;

  const host = authority.split(':')[0] ?? '';
  return allowedHosts.includes(host);
}
