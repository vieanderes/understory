export function orderByClause(sort: string): string {
  // Replace this. Whatever the request says ends up in the SQL.
  return `ORDER BY ${sort}`;
}
