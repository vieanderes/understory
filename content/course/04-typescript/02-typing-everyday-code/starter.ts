export type Film = {
  title: string;
  subtitle?: string;
  minutes: number;
};

export function filmLabel(film: Film): string {
  // This compiles, and prints "undefined" when a film has no subtitle.
  return `${film.title}: ${film.subtitle} (${film.minutes} min)`;
}
