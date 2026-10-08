export type ToolResult =
  | { ok: true; data: unknown }
  | { ok: false; error: 'failed' | 'unavailable'; retryable: boolean; message: string };

export type Breaker = { failures: number; openUntil: number };

export type Deps = {
  run: (name: string, args: object) => Promise<unknown>;
  now: () => number;
  breakers: Map<string, Breaker>;
  threshold: number;
  cooldownMs: number;
};

export async function callTool(name: string, args: object, deps: Deps): Promise<ToolResult> {
  // Give each tool its own breaker in deps.breakers, and check it before calling run.
  try {
    const data = await deps.run(name, args);
    return { ok: true, data };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, error: 'failed', retryable: true, message: `${name} failed: ${reason}` };
  }
}
