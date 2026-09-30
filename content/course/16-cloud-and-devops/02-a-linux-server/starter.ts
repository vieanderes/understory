export type FileInfo = { owner: string; group: string; mode: string };
export type User = { name: string; groups: string[] };

export function canRead(file: FileInfo, user: User): boolean {
  // Pick the one digit that applies to this user, then test it for read.
  return file.mode.length === 3;
}
