const SORTABLE = ['title', 'author', 'year'];

export function orderByClause(sort: string): string {
  if (SORTABLE.includes(sort)) return `ORDER BY ${sort}`;
  return 'ORDER BY title';
}
