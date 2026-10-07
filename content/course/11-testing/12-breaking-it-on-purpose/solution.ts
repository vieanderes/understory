export interface Reply {
  status: number;
  body: string;
}

export type Fault = 'ok' | 'slow' | 'error500' | 'timeout' | 'drop';

export type Call = (path: string) => Promise<Reply>;
export type Sleep = (ms: number) => Promise<void>;

export function injectFaults(call: Call, schedule: Fault[], sleep: Sleep, slowMs = 3000): Call {
  let index = 0;
  return async (path) => {
    // Every call takes the next slot, faulty or not, so a run replays exactly.
    const fault = schedule[index % schedule.length] ?? 'ok';
    index += 1;
    if (fault === 'error500') return { status: 500, body: 'Injected fault' };
    if (fault === 'timeout') {
      const error = new Error('The operation timed out');
      error.name = 'TimeoutError';
      throw error;
    }
    if (fault === 'drop') {
      throw Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' });
    }
    if (fault === 'slow') await sleep(slowMs);
    return call(path);
  };
}
