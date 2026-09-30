function rowsToCsv(rows) {
  const lines = ['name,qty'];
  for (const row of rows) lines.push(`${row.name},${row.qty}`);
  return lines.join('\n');
}

function rowsToList(rows) {
  const lines = [];
  for (const row of rows) lines.push(`${row.name}: ${row.qty}`);
  return lines.join('\n');
}
