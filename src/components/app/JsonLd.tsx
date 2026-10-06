/**
 * Structured data for crawlers. A data block is never executed, so the CSP does not apply;
 * `<` is escaped so text inside the data cannot close the script element.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
