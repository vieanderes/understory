export interface Person {
  first: string;
  last: string;
  title: string;
}

// Three callers, two flags, and nobody remembers which pair gives what. Inline it.
export function formatName(person: Person, formal: boolean, short: boolean): string {
  let name = short ? person.first : `${person.first} ${person.last}`;
  if (formal) name = `${person.title} ${name}`;
  if (formal && short) name = `${person.title} ${person.last}`;
  return name;
}
