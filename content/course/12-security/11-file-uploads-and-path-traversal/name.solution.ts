const ALLOWED_CHARACTERS = 'abcdefghijklmnopqrstuvwxyz0123456789-';
const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg'];

export function isSafeFileName(name: string): boolean {
  const parts = name.split('.');
  if (parts.length !== 2) return false;
  const [base = '', extension = ''] = parts;
  if (base === '' || !ALLOWED_EXTENSIONS.includes(extension)) return false;
  for (const ch of base) {
    if (!ALLOWED_CHARACTERS.includes(ch)) return false;
  }
  return true;
}
