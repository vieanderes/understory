export type Member = { id: string; name: string };

/** The name to show for a member id, or "Guest" when nobody has that id. */
export function displayName(members: readonly Member[], id: string): string {
  // `find` gives `Member | undefined`. The `!` tells the checker it's never undefined.
  return members.find((member) => member.id === id)!.name;
}
