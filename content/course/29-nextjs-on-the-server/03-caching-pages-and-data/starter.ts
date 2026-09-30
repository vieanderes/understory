export interface Life {
  revalidate: number;
  expire: number;
}

export type Answer = 'serve' | 'serve-and-refresh' | 'wait-for-fresh';

export function whatToServe(ageSeconds: number | null, life: Life): Answer {
  // Replace this. It serves the kept copy for ever, however old, even when there's none.
  return 'serve';
}
