export type Film = {
  title: string;
  subtitle?: string;
  minutes: number;
};

export function filmLabel(film: Film): string {
  // The `?` means the subtitle may be missing, so that case gets its own label.
  if (film.subtitle === undefined) {
    return `${film.title} (${film.minutes} min)`;
  }
  return `${film.title}: ${film.subtitle} (${film.minutes} min)`;
}
