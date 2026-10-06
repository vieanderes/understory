function solution(R: string[], C: string[]): string[] {
  type Tool = { write: boolean; params: Map<string, string> };
  const tools = new Map<string, Tool>();
  for (const entry of R) {
    const [name, mode, ...params] = entry.split(' ');
    const types = new Map<string, string>();
    for (const param of params) {
      const [key, type] = param.split(':');
      types.set(key!, type!);
    }
    tools.set(name!, { write: mode === 'write', params: types });
  }
  const valid: Record<string, (value: string) => boolean> = {
    int: (value) => /^-?[0-9]+$/.test(value),
    bool: (value) => value === 'true' || value === 'false',
    text: () => true,
  };
  return C.map((call) => {
    const [name, ...rest] = call.split(' ');
    const tool = tools.get(name!);
    if (tool === undefined) return 'unknown-tool';
    let approved = false;
    const args = new Map<string, string>();
    for (const token of rest) {
      if (token === 'approved') approved = true;
      else {
        const at = token.indexOf('=');
        args.set(token.slice(0, at), token.slice(at + 1));
      }
    }
    // The checks run in the order of the verdict list, so the first that applies wins.
    if ([...args.keys()].some((key) => !tool.params.has(key))) return 'unknown-arg';
    if ([...tool.params.keys()].some((key) => !args.has(key))) return 'missing-arg';
    for (const [key, type] of tool.params) {
      if (!valid[type]!(args.get(key)!)) return 'bad-type';
    }
    if (tool.write && !approved) return 'needs-approval';
    return 'ok';
  });
}
