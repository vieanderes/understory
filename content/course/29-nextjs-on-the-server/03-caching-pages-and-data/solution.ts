export interface Life {
  revalidate: number;
  expire: number;
}

export type Answer = 'serve' | 'serve-and-refresh' | 'wait-for-fresh';

export function whatToServe(ageSeconds: number | null, life: Life): Answer {
  // Nothing kept, or kept too long: the visitor has to wait for a fresh result.
  if (ageSeconds === null || ageSeconds >= life.expire) return 'wait-for-fresh';
  if (ageSeconds >= life.revalidate) return 'serve-and-refresh';
  return 'serve';
}
