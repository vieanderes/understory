import type { ProbeReport, TreeRow } from '@/core/playground';

/** Two spaces per level, as the HTML itself is indented in the lessons. */
const indent = (depth: number): string => '  '.repeat(depth);

function Row({ row }: { row: TreeRow }) {
  if (row.kind === 'text') {
    return (
      <>
        {indent(row.depth)}
        <span className="text-muted">&quot;</span>
        {row.text}
        <span className="text-muted">&quot;</span>
      </>
    );
  }
  if (row.kind === 'comment') {
    return (
      <span className="text-muted">
        {indent(row.depth)}
        {`<!-- ${row.text} -->`}
      </span>
    );
  }
  return (
    <>
      {indent(row.depth)}
      <span className="text-syntax-keyword">{row.tag}</span>
      {row.attrs.map((attr) => (
        <span key={attr.name} className="text-muted">
          {` ${attr.name}="${attr.value}"`}
        </span>
      ))}
    </>
  );
}

/**
 * The live document as the browser holds it: every element, its key attributes and its
 * text, nested the way the browser nested them. This is what "the DOM" means, drawn from
 * the page the learner is building, so a missing end tag shows up as a surprise child.
 */
export function DomTree({ report }: { report: ProbeReport | null }) {
  return (
    <section aria-labelledby="playground-tree" className="flex min-w-0 flex-col gap-1">
      <h3 id="playground-tree" className="t-label">
        DOM tree
      </h3>
      {report === null ? (
        <p className="text-muted text-sm">The tree appears once the page has loaded.</p>
      ) : (
        <div
          // Wide trees scroll inside their own box, and a keyboard can reach that scroll.
          tabIndex={0}
          role="region"
          aria-label="DOM tree of your page"
          className="bg-surface border-border rounded-panel overflow-x-auto border p-2 font-mono text-sm"
        >
          <ol data-testid="dom-tree" className="flex flex-col">
            {report.tree.map((row, i) => (
              <li key={i} className="whitespace-pre">
                <Row row={row} />
              </li>
            ))}
          </ol>
          {report.truncated ? (
            <p className="text-muted pt-1 font-sans">The tree is cut short here.</p>
          ) : null}
        </div>
      )}
    </section>
  );
}
