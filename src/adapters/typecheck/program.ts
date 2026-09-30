import type * as TS from 'typescript';
import type { DiagnosticFile, RawDiagnostic, TypeCheckRequest } from '@/core/ports/type-checker';
import { CHECKER_COMPILER_OPTIONS, CHECKER_FILES, SANDBOX_GLOBALS } from '@/core/typecheck/options';

/*
 * The TypeScript program behind both checkers: the Web Worker in the browser and the
 * content gate in Node. The compiler module and the library files are passed in, because
 * the worker has them bundled and Node reads them from node_modules. Nothing here touches
 * a file system or a global.
 */

export interface CheckerEnvironment {
  /** A standard library file by name, for example `lib.es5.d.ts`. */
  readLib(name: string): string | undefined;
  /** The harness globals the tests use: content/harness.d.ts. */
  harness: string;
}

export interface ProgramCheckOptions {
  /** Also report the tests' own errors. The gate wants them; the learner never sees them. */
  tests?: boolean;
}

export type ProgramChecker = (
  request: TypeCheckRequest,
  options?: ProgramCheckOptions,
) => RawDiagnostic[];

const CATEGORY: Record<number, RawDiagnostic['category']> = {
  0: 'warning',
  1: 'error',
  2: 'suggestion',
  3: 'message',
};

export function createProgramChecker(ts: typeof TS, env: CheckerEnvironment): ProgramChecker {
  const converted = ts.convertCompilerOptionsFromJson(CHECKER_COMPILER_OPTIONS, '/');
  if (converted.errors.length > 0) {
    const first = converted.errors[0];
    throw new Error(
      `Invalid checker options: ${first ? ts.flattenDiagnosticMessageText(first.messageText, ' ') : ''}`,
    );
  }
  const options = converted.options;
  const libName = (fileName: string): string | null =>
    fileName.startsWith(CHECKER_FILES.libDir) ? fileName.slice(CHECKER_FILES.libDir.length) : null;

  const fixedText = (fileName: string): string | undefined => {
    if (fileName === CHECKER_FILES.harness) return env.harness;
    if (fileName === CHECKER_FILES.sandbox) return SANDBOX_GLOBALS;
    const lib = libName(fileName);
    return lib === null ? undefined : env.readLib(lib);
  };

  // The library, the harness and the sandbox globals never change: parsed once, they are
  // what makes every later check take milliseconds.
  const fixed = new Map<string, TS.SourceFile>();
  const fixedSource = (fileName: string, version: TS.ScriptTarget): TS.SourceFile | undefined => {
    const cached = fixed.get(fileName);
    if (cached) return cached;
    const text = fixedText(fileName);
    if (text === undefined) return undefined;
    const file = ts.createSourceFile(fileName, text, version);
    fixed.set(fileName, file);
    return file;
  };

  // The tests are the same from one keystroke to the next.
  let testsFile: TS.SourceFile | undefined;
  let oldProgram: TS.Program | undefined;

  return (request, checkOptions = {}) => {
    const host: TS.CompilerHost = {
      getSourceFile(fileName, version) {
        if (fileName === CHECKER_FILES.code) {
          return ts.createSourceFile(fileName, request.code, version);
        }
        if (fileName === CHECKER_FILES.tests) {
          if (testsFile?.text !== request.tests) {
            testsFile = ts.createSourceFile(fileName, request.tests, version);
          }
          return testsFile;
        }
        return fixedSource(
          fileName,
          typeof version === 'object' ? version.languageVersion : version,
        );
      },
      getDefaultLibFileName: () => `${CHECKER_FILES.libDir}lib.d.ts`,
      writeFile: () => undefined,
      getCurrentDirectory: () => '/',
      getDirectories: () => [],
      getCanonicalFileName: (fileName) => fileName,
      useCaseSensitiveFileNames: () => true,
      getNewLine: () => '\n',
      fileExists: (fileName) =>
        fileName === CHECKER_FILES.code ||
        fileName === CHECKER_FILES.tests ||
        fixedText(fileName) !== undefined,
      readFile: (fileName) => {
        if (fileName === CHECKER_FILES.code) return request.code;
        if (fileName === CHECKER_FILES.tests) return request.tests;
        return fixedText(fileName);
      },
      // The harness binds every relative import to the code under test, whatever the
      // name ('./solution', './fare.solution'). The checker does the same. A package
      // import resolves to nothing, and is an error, as it is when the code runs.
      resolveModuleNameLiterals: (literals) =>
        literals.map((literal) => ({
          resolvedModule: literal.text.startsWith('.')
            ? {
                resolvedFileName: CHECKER_FILES.code,
                extension: ts.Extension.Ts,
                isExternalLibraryImport: false,
              }
            : undefined,
        })),
    };

    const program = ts.createProgram({
      rootNames: [
        CHECKER_FILES.code,
        CHECKER_FILES.tests,
        CHECKER_FILES.harness,
        CHECKER_FILES.sandbox,
      ],
      options,
      host,
      oldProgram,
    });
    oldProgram = program;

    const fileOf = (d: TS.Diagnostic): DiagnosticFile => {
      if (d.file?.fileName === CHECKER_FILES.code) return 'code';
      if (d.file?.fileName === CHECKER_FILES.tests) return 'tests';
      return 'other';
    };
    const toRaw = (d: TS.Diagnostic): RawDiagnostic => ({
      file: fileOf(d),
      ...(d.start === undefined ? {} : { start: d.start }),
      ...(d.length === undefined ? {} : { length: d.length }),
      code: d.code,
      category: CATEGORY[d.category] ?? 'error',
      message: ts.flattenDiagnosticMessageText(d.messageText, '\n'),
    });

    const diagnostics: TS.Diagnostic[] = [
      ...program.getOptionsDiagnostics(),
      ...program.getGlobalDiagnostics(),
    ];
    const files = checkOptions.tests
      ? [CHECKER_FILES.code, CHECKER_FILES.tests]
      : [CHECKER_FILES.code];
    for (const name of files) {
      const file = program.getSourceFile(name);
      if (!file) continue;
      diagnostics.push(
        ...program.getSyntacticDiagnostics(file),
        ...program.getSemanticDiagnostics(file),
      );
    }
    return diagnostics.map(toRaw);
  };
}
