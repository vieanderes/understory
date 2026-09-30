import type { ValueType } from './values';

/*
 * A task's function, written the way the platform writes it for each language: in the
 * statement (`function solution(A);`) and in the starter the editor opens with. The
 * starters copy the platform's comment lines word for word, because they are the first
 * thing a candidate sees, and seeing them here makes the real one familiar.
 */

export const TASK_LANGUAGES = ['js', 'ts', 'python'] as const;
export type TaskLanguage = (typeof TASK_LANGUAGES)[number];

export interface Param {
  name: string;
  type: ValueType;
}

export interface Signature {
  params: Param[];
  returns: ValueType;
}

/** The platform always calls it this. */
export const FUNCTION_NAME = 'solution';

export const LANGUAGE_LABEL: Record<TaskLanguage, string> = {
  js: 'JavaScript',
  ts: 'TypeScript',
  python: 'Python',
};

export const FILE_EXTENSION: Record<TaskLanguage, string> = {
  js: 'js',
  ts: 'ts',
  python: 'py',
};

/** What the hint bar under the editor names. Our sandbox, so our versions. */
export const LANGUAGE_VERSION: Record<TaskLanguage, string> = {
  js: 'JavaScript ES2023 (browser sandbox)',
  ts: 'TypeScript 5 (browser sandbox)',
  python: 'Python 3.12 (Pyodide)',
};

const TS_TYPE: Record<ValueType, string> = {
  int: 'number',
  bool: 'boolean',
  string: 'string',
  'int[]': 'number[]',
  'string[]': 'string[]',
  'int[][]': 'number[][]',
};

function header(signature: Signature, language: TaskLanguage): string {
  const names = signature.params.map((p) => p.name);
  if (language === 'python') return `def ${FUNCTION_NAME}(${names.join(', ')})`;
  if (language === 'js') return `function ${FUNCTION_NAME}(${names.join(', ')})`;
  const typed = signature.params.map((p) => `${p.name}: ${TS_TYPE[p.type]}`);
  return `function ${FUNCTION_NAME}(${typed.join(', ')}): ${TS_TYPE[signature.returns]}`;
}

/** As the statement shows it: `function solution(A);`, `def solution(A)`. */
export function signatureLine(signature: Signature, language: TaskLanguage): string {
  const line = header(signature, language);
  return language === 'python' ? line : `${line};`;
}

export function starterCode(signature: Signature, language: TaskLanguage): string {
  if (language === 'python') {
    return [
      '# you can write to stdout for debugging purposes, e.g.',
      '# print("this is a debug message")',
      '',
      `${header(signature, language)}:`,
      '    # Implement your solution here',
      '    pass',
      '',
    ].join('\n');
  }
  return [
    '// you can write to stdout for debugging purposes, e.g.',
    "// console.log('this is a debug message');",
    '',
    `${header(signature, language)} {`,
    '    // Implement your solution here',
    '}',
    '',
  ].join('\n');
}

export function isTaskLanguage(value: unknown): value is TaskLanguage {
  return typeof value === 'string' && (TASK_LANGUAGES as readonly string[]).includes(value);
}
