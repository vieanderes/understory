/**
 * A script that runs while the HTML is parsed, before first paint. The type flips to
 * text/plain on the client so React does not warn about rendering a script tag; the
 * mismatch is expected and suppressed (Next.js guide: preventing flash before hydration).
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
