/**
 * Every bound on what a run may send or produce, in one place. The harness string
 * (harness.ts) repeats the log and test caps because it cannot import; a unit test
 * keeps the two in step.
 */
export const LIMITS = {
  /** Learner code and tests, each. Far above any lesson, far below a memory problem. */
  maxSourceBytes: 256 * 1024,
  minTimeoutMs: 100,
  maxTimeoutMs: 30_000,
  /** The React runtime of a tsx run: about 1 MB today, with room for React to grow. */
  maxRuntimeBytes: 4 * 1024 * 1024,
  maxLogLines: 200,
  maxLogBytes: 64 * 1024,
  /** One log line. A single huge line must not eat the whole byte budget unseen. */
  maxLogLineLength: 4_000,
  maxTests: 200,
  maxTestNameLength: 200,
  maxMessageLength: 2_000,
  maxRunIdLength: 64,
  /** Grace the parent gives the frame beyond `timeoutMs` before it removes the frame. */
  watchdogGraceMs: 1_500,
  /** How long the parent waits for the frame to load and answer `init`. */
  handshakeTimeoutMs: 10_000,
  /**
   * How long a Python run may wait for Pyodide to start before the run's own budget
   * begins. A cold start is about 1.5 s on a laptop and several seconds on a slow phone.
   */
  pythonBootTimeoutMs: 60_000,
  /** One Pyodide file handed to the frame. The largest, the wasm binary, is about 10 MB. */
  maxPythonAssetBytes: 32 * 1024 * 1024,
  /** Wheels in one `python-packages` message: the three packages need nine today. */
  maxPythonPackageFiles: 32,
} as const;

export const LOG_TRUNCATION_NOTICE = '[Output truncated: more than 200 lines or 64 KB]';
