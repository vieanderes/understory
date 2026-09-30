import type { SqlTableInfo } from '@/core/sql';

interface SchemaPanelProps {
  tables: SqlTableInfo[] | null;
  /** Why the tables could not be read, when they could not. */
  failure?: string;
}

function keyOf(column: SqlTableInfo['columns'][number]): string {
  if (column.primaryKey) return 'primary key';
  if (column.references) return `references ${column.references}`;
  return column.notNull ? 'not null' : '';
}

/**
 * The tables the step's setup made, read from the database itself, so the panel can never
 * disagree with what the learner queries. One small table per table: column, type, key.
 */
export function SchemaPanel({ tables, failure }: SchemaPanelProps) {
  return (
    <section aria-labelledby="sql-schema" className="flex flex-col gap-1">
      <h3 id="sql-schema" className="t-label">
        Tables
      </h3>
      {failure ? (
        <p className="text-muted text-sm">The tables could not be read. {failure}</p>
      ) : tables === null ? (
        <p className="text-muted font-mono text-sm">Loading the tables</p>
      ) : tables.length === 0 ? (
        <p className="text-muted text-sm">No tables yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {tables.map((table) => (
            <div
              key={table.name}
              role="region"
              aria-label={`Table ${table.name}`}
              tabIndex={0}
              className="border-border rounded-inner overflow-x-auto border outline-offset-2"
            >
              <table className="w-full border-collapse font-mono text-sm">
                <caption className="bg-sunken px-1 py-0.5 text-left font-medium">
                  {table.name}
                </caption>
                <thead className="sr-only">
                  <tr>
                    <th scope="col">Column</th>
                    <th scope="col">Type</th>
                    <th scope="col">Key</th>
                  </tr>
                </thead>
                <tbody>
                  {table.columns.map((column) => (
                    <tr key={column.name} className="border-border border-t">
                      <th
                        scope="row"
                        className="px-1 py-0.5 text-left font-normal whitespace-nowrap"
                      >
                        {column.name}
                      </th>
                      <td className="text-muted px-1 py-0.5 whitespace-nowrap">{column.type}</td>
                      <td className="text-muted px-1 py-0.5 whitespace-nowrap">{keyOf(column)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
