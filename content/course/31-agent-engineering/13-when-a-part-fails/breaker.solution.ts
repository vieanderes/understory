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

function unavailable(name: string): ToolResult {
  return {
    ok: false,
    error: 'unavailable',
    retryable: false,
    message: `${name} is unavailable. Don't call it again in this task. Use another source or tell the user.`,
  };
}

export async function callTool(name: string, args: object, deps: Deps): Promise<ToolResult> {
  const breaker = deps.breakers.get(name) ?? { failures: 0, openUntil: 0 };
  deps.breakers.set(name, breaker);
  // Open: answer at once, so the model spends no turn waiting on a dead service.
  if (deps.now() < breaker.openUntil) return unavailable(name);
  try {
    const data = await deps.run(name, args);
    breaker.failures = 0;
    return { ok: true, data };
  } catch (error) {
    // The count isn't reset on opening, so a failed trial after the cool-down reopens at once.
    breaker.failures += 1;
    if (breaker.failures >= deps.threshold) {
      breaker.openUntil = deps.now() + deps.cooldownMs;
      return unavailable(name);
    }
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, error: 'failed', retryable: true, message: `${name} failed: ${reason}` };
  }
}
