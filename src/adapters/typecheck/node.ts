import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import ts from 'typescript';
import type { TypeChecker } from '@/core/ports/type-checker';
import { normaliseDiagnostics } from '@/core/typecheck/diagnostics';
import { createProgramChecker, type ProgramChecker } from './program';

/*
 * The checker in Node, for the content gate and the unit tests: the same program as the
 * browser worker, with the installed compiler and its library files read from disk.
 */

const ROOT = process.cwd();

export function createNodeProgramChecker(root: string = ROOT): ProgramChecker {
  const libDir = path.dirname(createRequire(path.join(root, 'package.json')).resolve('typescript'));
  const libs = new Map<string, string | undefined>();
  return createProgramChecker(ts, {
    readLib(name) {
      // Only plain names: a lib reference never climbs out of the directory.
      if (!/^lib\.[\w.]+\.d\.ts$/.test(name)) return undefined;
      if (!libs.has(name)) {
        try {
          libs.set(name, readFileSync(path.join(libDir, name), 'utf8'));
        } catch {
          libs.set(name, undefined);
        }
      }
      return libs.get(name);
    },
    harness: readFileSync(path.join(root, 'content/harness.d.ts'), 'utf8'),
  });
}

/** The port, for code that wants the learner's view: normalised errors in their file only. */
export function createNodeTypeChecker(root: string = ROOT): TypeChecker {
  const check = createNodeProgramChecker(root);
  return {
    check: (request) =>
      Promise.resolve({
        status: 'checked',
        diagnostics: normaliseDiagnostics(check(request), request.code),
      }),
  };
}
