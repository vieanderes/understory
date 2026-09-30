export type Profile = {
  name: string;
  city: string;
  age: number;
};

/**
 * A settings form sends only the fields someone touched. A field sent as `undefined`
 * means "not changed".
 */
export function applyChanges(profile: Profile, changes: Partial<Profile>): Profile {
  // A copy, so the caller's profile stays as it was.
  const result = { ...profile };
  // Compare with undefined, not truthiness: an age of 0 or an empty city is a real change.
  if (changes.name !== undefined) result.name = changes.name;
  if (changes.city !== undefined) result.city = changes.city;
  if (changes.age !== undefined) result.age = changes.age;
  return result;
}
