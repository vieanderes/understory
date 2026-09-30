// One function, two jobs, picked by a true or false nobody can read at the call site:
// formatRows(rows, true). Split it into rowsToCsv(rows) and rowsToList(rows).
function formatRows(rows, csv) {
  if (csv) {
    const lines = ['name,qty'];
    for (const row of rows) lines.push(`${row.name},${row.qty}`);
    return lines.join('\n');
  }
  const lines = [];
  for (const row of rows) lines.push(`${row.name}: ${row.qty}`);
  return lines.join('\n');
}
