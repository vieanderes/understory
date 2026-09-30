// A model call that already has its timeout and retries.
export type Complete = (prompt: string) => Promise<string>;

export type Client = {
  complete(prompt: string): Promise<string>;
  completeMany(prompts: string[], limit: number): Promise<string[]>;
};

export function createClient(call: Complete): Client {
  // The promise, not the answer: a call made while the first is still running shares it.
  const cache = new Map<string, Promise<string>>();

  function complete(prompt: string): Promise<string> {
    const cached = cache.get(prompt);
    if (cached) return cached;
    const pending = call(prompt);
    cache.set(prompt, pending);
    // Forget a failure, or every later caller gets the same error for ever.
    pending.catch(() => cache.delete(prompt));
    return pending;
  }

  async function completeMany(prompts: string[], limit: number): Promise<string[]> {
    const results: string[] = [];
    let next = 0;
    // No `await` between the check and taking the index, so two workers never share one.
    async function worker(): Promise<void> {
      while (next < prompts.length) {
        const index = next;
        next += 1;
        results[index] = await complete(prompts[index] as string);
      }
    }
    const workers: Promise<void>[] = [];
    for (let i = 0; i < Math.min(limit, prompts.length); i++) workers.push(worker());
    await Promise.all(workers);
    return results;
  }

  return { complete, completeMany };
}
