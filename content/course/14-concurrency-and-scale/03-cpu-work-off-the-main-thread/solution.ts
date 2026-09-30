// The part of a Node `Worker` this code uses. A test hands in a fake one.
export interface WorkerLike {
  on(event: 'message' | 'error', listener: (value: unknown) => void): void;
  postMessage(value: unknown): void;
  terminate(): void;
}

// Sends `job` to the worker and settles with its first reply or its error.
export function runInWorker(worker: WorkerLike, job: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    // Listen before sending: a reply can arrive before the next line runs.
    worker.on('message', (reply) => {
      worker.terminate();
      resolve(reply);
    });
    worker.on('error', (error) => {
      worker.terminate();
      reject(error);
    });
    worker.postMessage(job);
  });
}
