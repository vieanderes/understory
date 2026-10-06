export interface Reply {
  status: number;
  body: string;
}

export type Fault = 'ok' | 'slow' | 'error500' | 'timeout' | 'drop';

export type Call = (path: string) => Promise<Reply>;
export type Sleep = (ms: number) => Promise<void>;

export function injectFaults(call: Call, schedule: Fault[], sleep: Sleep, slowMs = 3000): Call {
  return async (path) => {
    // Replace this. It never injects anything, so every test sees a healthy vendor.
    return call(path);
  };
}
