export interface Person {
  first: string;
  last: string;
  title: string;
}

export function fullName(person: Person): string {
  return `${person.first} ${person.last}`;
}

export function greetingName(person: Person): string {
  return person.first;
}

// A letter opens with the title and surname, or the full name when there's no title.
export function letterName(person: Person): string {
  return person.title === '' ? fullName(person) : `${person.title} ${person.last}`;
}
