const ALLOWED_CHARACTERS = 'abcdefghijklmnopqrstuvwxyz0123456789-';
const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg'];

export function isSafeFileName(name: string): boolean {
  // Replace this. It only refuses names that start with a dot.
  return !name.startsWith('.');
}
