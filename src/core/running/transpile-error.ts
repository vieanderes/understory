/** Thrown by a `Transpiler` when the source does not parse. Carries the 1-based line. */
export class TranspileError extends Error {
  override readonly name = 'TranspileError';
  readonly line: number | undefined;

  constructor(message: string, line?: number) {
    super(message);
    this.line = line;
  }
}
