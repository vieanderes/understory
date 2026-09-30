export type FileInfo = { owner: string; group: string; mode: string };
export type User = { name: string; groups: string[] };

// A mode like '640' has one digit each for the owner, the group and everyone else.
// Read is worth 4, so a digit of 4 or more grants it.
export function canRead(file: FileInfo, user: User): boolean {
  if (user.name === 'root') return true;
  let digit = Number(file.mode[2]);
  if (user.name === file.owner) {
    digit = Number(file.mode[0]);
  } else if (user.groups.includes(file.group)) {
    digit = Number(file.mode[1]);
  }
  return digit >= 4;
}
