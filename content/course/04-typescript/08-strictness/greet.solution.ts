export type Member = { id: string; name: string };

/** The name to show for a member id, or "Guest" when nobody has that id. */
export function displayName(members: readonly Member[], id: string): string {
  const member = members.find((candidate) => candidate.id === id);
  // Narrowing handles the missing member instead of promising it can't happen.
  if (member === undefined) {
    return 'Guest';
  }
  return member.name;
}
