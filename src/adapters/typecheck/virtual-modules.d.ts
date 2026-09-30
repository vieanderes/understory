/*
 * Modules that exist only while scripts/build-typecheck.ts bundles the checker worker.
 */

declare module 'understory:typescript-libs' {
  /** Every standard library file the checker's `lib` setting reaches, by file name. */
  const libs: Readonly<Record<string, string>>;
  export default libs;
}

declare module 'understory:checker-harness' {
  /** content/harness.d.ts, as text. */
  const harness: string;
  export default harness;
}
