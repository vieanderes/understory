/**
 * The type-checker contract (docs/SANDBOX.md, "Type checking"). The browser implements it
 * with the TypeScript compiler in a Web Worker, the content gate with the same compiler in
 * Node. Both build the same program from the same options (src/core/typecheck/options.ts),
 * so the editor and the gate agree on what is a type error.
 *
 * Nothing here runs learner code. The compiler only reads it.
 */

export interface TypeCheckRequest {
  /** The learner's file, as typed. Diagnostics are reported for this file only. */
  code: string;
  /** The step's tests. Context for the program; their own diagnostics are never shown. */
  tests: string;
}

/** Where a diagnostic came from, before core picks the ones a learner sees. */
export type DiagnosticFile = 'code' | 'tests' | 'other';

/** A compiler diagnostic as the adapter reads it: offsets, not lines, and one message. */
export interface RawDiagnostic {
  file: DiagnosticFile;
  /** Offset into the file. Absent for a diagnostic about the program as a whole. */
  start?: number;
  length?: number;
  /** TypeScript's error number, for example 2345. */
  code: number;
  category: 'error' | 'warning' | 'suggestion' | 'message';
  /** The message chain, already joined with line breaks. */
  message: string;
}

/** One type error in the learner's file, ready to draw and to read out. */
export interface TypeDiagnostic {
  /** Offsets into the learner's code. `to` is always past `from`, so there is something to underline. */
  from: number;
  to: number;
  /** 1-based, where `from` is. */
  line: number;
  column: number;
  code: number;
  message: string;
}

export type TypeCheckOutcome =
  | { status: 'checked'; diagnostics: TypeDiagnostic[] }
  /** The checker could not load or did not answer. Learning goes on: the tests still decide. */
  | { status: 'unavailable'; reason: string };

export interface TypeChecker {
  /** Never rejects. A checker that cannot answer resolves `unavailable`. */
  check(request: TypeCheckRequest): Promise<TypeCheckOutcome>;
}
