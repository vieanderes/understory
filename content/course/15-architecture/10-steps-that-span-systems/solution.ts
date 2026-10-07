export interface SagaStep {
  name: string;
  run: () => Promise<void>;
  // Absent when the step can't be undone, such as a sent email.
  undo?: () => Promise<void>;
}

export interface SagaResult {
  ok: boolean;
  log: string[];
  // Steps whose undo threw, left for a person or a reconciliation job.
  stuck: string[];
}

export async function runSaga(steps: SagaStep[]): Promise<SagaResult> {
  const log: string[] = [];
  const done: SagaStep[] = [];
  for (const step of steps) {
    try {
      await step.run();
    } catch {
      log.push(`failed ${step.name}`);
      return { ok: false, log, stuck: await compensate(done, log) };
    }
    log.push(`ran ${step.name}`);
    done.push(step);
  }
  return { ok: true, log, stuck: [] };
}

// Newest first, and one failed undo never stops the others.
async function compensate(done: SagaStep[], log: string[]): Promise<string[]> {
  const stuck: string[] = [];
  for (const step of [...done].reverse()) {
    if (!step.undo) continue;
    try {
      await step.undo();
      log.push(`undid ${step.name}`);
    } catch {
      log.push(`undo failed ${step.name}`);
      stuck.push(step.name);
    }
  }
  return stuck;
}
