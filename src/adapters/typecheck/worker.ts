/*
 * The type-checker Web Worker. scripts/build-typecheck.ts bundles this file with the
 * TypeScript compiler, the ES2023 library files and content/harness.d.ts into
 * public/typescript/checker.<hash>.js; the page starts it only when a TypeScript
 * challenge is on screen (src/adapters/typecheck/worker-checker.ts).
 *
 * It reads learner code and never runs it, so it needs none of the sandbox's walls.
 */
import ts from 'typescript';
import harness from 'understory:checker-harness';
import libs from 'understory:typescript-libs';
import { checkRequestSchema, type CheckReply } from '@/core/typecheck/protocol';
import { createProgramChecker } from './program';

interface WorkerScope {
  postMessage(message: CheckReply): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
}

const scope = self as unknown as WorkerScope;
const check = createProgramChecker(ts, { readLib: (name) => libs[name], harness });

scope.addEventListener('message', (event) => {
  const request = checkRequestSchema.safeParse(event.data);
  if (!request.success) return;
  const { id, code, tests } = request.data;
  try {
    scope.postMessage({ v: 1, id, diagnostics: check({ code, tests }) });
  } catch (error) {
    // A compiler crash on odd input must not leave the page waiting.
    scope.postMessage({ v: 1, id, failure: error instanceof Error ? error.message : 'crashed' });
  }
});
