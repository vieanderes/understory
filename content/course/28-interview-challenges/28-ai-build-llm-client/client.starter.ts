// A model call that already has its timeout and retries.
export type Complete = (prompt: string) => Promise<string>;

export type Client = {
  complete(prompt: string): Promise<string>;
  completeMany(prompts: string[], limit: number): Promise<string[]>;
};

export function createClient(call: Complete): Client {
  function complete(prompt: string): Promise<string> {
    // Every call reaches the model, even one asked a moment ago.
    return call(prompt);
  }

  function completeMany(prompts: string[], limit: number): Promise<string[]> {
    // All at once: a thousand prompts means a thousand calls in flight.
    return Promise.all(prompts.map((prompt) => complete(prompt)));
  }

  return { complete, completeMany };
}
