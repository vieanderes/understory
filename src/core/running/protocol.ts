import * as z from '@/core/zod';
import { LIMITS } from './limits';
import { PYTHON_PACKAGES } from './python-packages';

/**
 * The wire protocol between the app and the sandbox frame, and between the frame and
 * its worker. Both ends parse every message with these schemas. The frame runs hostile
 * code, so the parent trusts nothing it says beyond what the schemas allow, and the
 * bounds here stop a compromised frame from flooding the app with data.
 *
 * Version 1. A breaking change ships as `runner.v2.html` with `v: 2` beside this one.
 */
export const PROTOCOL_VERSION = 1;

const runId = z.string().min(1).max(LIMITS.maxRunIdLength);
const envelope = { v: z.literal(PROTOCOL_VERSION), runId };

export const testResultSchema = z.strictObject({
  name: z.string().max(LIMITS.maxTestNameLength),
  passed: z.boolean(),
  message: z.string().max(LIMITS.maxMessageLength).optional(),
});

export const runErrorSchema = z.strictObject({
  name: z.string().max(LIMITS.maxTestNameLength),
  message: z.string().max(LIMITS.maxMessageLength),
  line: z.number().int().positive().optional(),
});

const logLine = z.string().max(LIMITS.maxLogLineLength);

/** One extra line is allowed for the truncation notice. */
const logLines = z.array(logLine).max(LIMITS.maxLogLines + 1);

/** What `__run()` in the harness resolves with. The same shape in every runtime. */
export const harnessReportSchema = z.strictObject({
  status: z.enum(['passed', 'failed', 'error']),
  tests: z.array(testResultSchema).max(LIMITS.maxTests),
  logs: logLines,
  error: runErrorSchema.optional(),
});
export type HarnessReport = z.infer<typeof harnessReportSchema>;

// Parent to frame -----------------------------------------------------------------------

/** Sent once on `window.postMessage` with the MessagePort in the transfer list. */
export const initMessageSchema = z.strictObject({ ...envelope, type: z.literal('init') });

const source = z.string().max(LIMITS.maxSourceBytes);

/**
 * The React runtime travels with each tsx run. The frame has an opaque origin and
 * `default-src 'none'`, so it cannot fetch the file itself; the parent loads it from
 * the app origin (and the service worker's cache) and hands the text over.
 */
export const runtimeSchema = z.strictObject({
  name: z.literal('react'),
  source: z.string().max(LIMITS.maxRuntimeBytes),
});

/**
 * `code` and `tests` are plain JavaScript by now: the parent has already transpiled. A
 * Python run carries the source as written, and the frame hands it to Pyodide. `engine`
 * picks the worker; `runtime` is extra code the JavaScript worker evaluates first.
 */
export const runMessageSchema = z.strictObject({
  ...envelope,
  type: z.literal('run'),
  engine: z.enum(['js', 'python']),
  code: source,
  tests: source,
  timeoutMs: z.number().int().min(LIMITS.minTimeoutMs).max(LIMITS.maxTimeoutMs),
  harnessVersion: z.literal(1),
  runtime: runtimeSchema.optional(),
  /** Python only: packages the worker loads and imports before the budget starts. */
  packages: z.array(z.enum(PYTHON_PACKAGES)).max(PYTHON_PACKAGES.length).optional(),
});

const assetBytes = z
  .instanceof(ArrayBuffer)
  .refine((buffer) => buffer.byteLength <= LIMITS.maxPythonAssetBytes, 'Asset too large');

/**
 * The Pyodide files, fetched by the parent from its own origin. The frame has an opaque
 * origin and `default-src 'none'`, so it can fetch nothing itself (docs/SANDBOX.md,
 * "Python"). Sent once per frame, before the first Python run; the frame keeps them to
 * start a fresh interpreter after a timeout.
 */
export const pythonAssetsMessageSchema = z.strictObject({
  ...envelope,
  type: z.literal('python-assets'),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  loader: assetBytes,
  runtime: assetBytes,
  wasm: assetBytes,
  stdlib: assetBytes,
  lock: assetBytes,
});

/** A wheel's file name as the Pyodide lock file gives it. No path, so no traversal. */
const wheelName = z
  .string()
  .regex(/^[\w.+-]+\.whl$/)
  .max(200);

/**
 * Package wheels, fetched by the parent like the Pyodide files, when a run first imports
 * numpy, pandas or pydantic (docs/SANDBOX.md, "Packages"). The frame keeps them for the
 * life of the frame, so an interpreter started after a timeout can load them again.
 */
export const pythonPackagesMessageSchema = z.strictObject({
  ...envelope,
  type: z.literal('python-packages'),
  files: z
    .record(wheelName, assetBytes)
    .refine(
      (files) => Object.keys(files).length <= LIMITS.maxPythonPackageFiles,
      'Too many wheels',
    ),
});

export const parentMessageSchema = z.discriminatedUnion('type', [
  initMessageSchema,
  runMessageSchema,
  pythonAssetsMessageSchema,
  pythonPackagesMessageSchema,
]);

// Frame to parent -----------------------------------------------------------------------

export const readyMessageSchema = z.strictObject({
  ...envelope,
  type: z.literal('ready'),
  harnessVersion: z.literal(1),
});

/** Streamed while the run is live, so output survives a run that ends in a timeout. */
export const logMessageSchema = z.strictObject({
  ...envelope,
  type: z.literal('log'),
  line: logLine,
});

export const doneMessageSchema = z.strictObject({
  ...envelope,
  type: z.literal('done'),
  status: z.enum(['passed', 'failed', 'timeout', 'error']),
  tests: z.array(testResultSchema).max(LIMITS.maxTests),
  logs: logLines,
  error: runErrorSchema.optional(),
});

/**
 * The run's own budget starts now. Sent for Python runs once the interpreter is warm, so
 * the parent's watchdog can allow for the Pyodide start before it and count `timeoutMs`
 * from here.
 */
export const startedMessageSchema = z.strictObject({ ...envelope, type: z.literal('started') });

export const frameMessageSchema = z.discriminatedUnion('type', [
  readyMessageSchema,
  logMessageSchema,
  startedMessageSchema,
  doneMessageSchema,
]);

// Worker to frame -----------------------------------------------------------------------

/**
 * The worker is where learner code lives, so the frame treats it as the least trusted
 * party. `nonce` is a per-run secret held in a closure the learner's code cannot reach;
 * it makes a forged `done` harder, nothing more (docs/SANDBOX.md, "Integrity").
 */
const workerEnvelope = { nonce: z.string().min(1).max(64) };

export const workerMessageSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...workerEnvelope, type: z.literal('started') }),
  z.strictObject({ ...workerEnvelope, type: z.literal('log'), line: logLine }),
  z.strictObject({ ...workerEnvelope, type: z.literal('done'), report: harnessReportSchema }),
]);

/**
 * The Python worker lives across runs, so its messages name the run they belong to, and
 * `ready` and `boot-error` report the interpreter start. `started` says the run's
 * packages are loaded and its code is about to run. `fatal` on `done` says the
 * interpreter itself broke (a wasm stack overflow, say) and must be replaced.
 */
export const pythonWorkerMessageSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...workerEnvelope, type: z.literal('ready') }),
  z.strictObject({ ...workerEnvelope, type: z.literal('started'), runId }),
  z.strictObject({
    ...workerEnvelope,
    type: z.literal('boot-error'),
    message: z.string().max(LIMITS.maxMessageLength),
  }),
  z.strictObject({ ...workerEnvelope, type: z.literal('log'), runId, line: logLine }),
  z.strictObject({
    ...workerEnvelope,
    type: z.literal('done'),
    runId,
    report: harnessReportSchema,
    fatal: z.boolean(),
  }),
]);

export type InitMessage = z.infer<typeof initMessageSchema>;
export type PythonAssetsMessage = z.infer<typeof pythonAssetsMessageSchema>;
export type PythonPackagesMessage = z.infer<typeof pythonPackagesMessageSchema>;
export type PythonWorkerMessage = z.infer<typeof pythonWorkerMessageSchema>;
export type RunMessage = z.infer<typeof runMessageSchema>;
export type ParentMessage = z.infer<typeof parentMessageSchema>;
export type ReadyMessage = z.infer<typeof readyMessageSchema>;
export type LogMessage = z.infer<typeof logMessageSchema>;
export type DoneMessage = z.infer<typeof doneMessageSchema>;
export type FrameMessage = z.infer<typeof frameMessageSchema>;
export type WorkerMessage = z.infer<typeof workerMessageSchema>;

/** Parses without throwing. A message that does not fit is dropped by the caller. */
export function parseParentMessage(data: unknown): ParentMessage | null {
  const parsed = parentMessageSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export function parseFrameMessage(data: unknown): FrameMessage | null {
  const parsed = frameMessageSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export function parseWorkerMessage(data: unknown): WorkerMessage | null {
  const parsed = workerMessageSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export function parsePythonWorkerMessage(data: unknown): PythonWorkerMessage | null {
  const parsed = pythonWorkerMessageSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export function parseHarnessReport(data: unknown): HarnessReport | null {
  const parsed = harnessReportSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}
