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
  // This compiles, and `{ name: undefined }` wipes out the name.
  return { ...profile, ...changes };
}
