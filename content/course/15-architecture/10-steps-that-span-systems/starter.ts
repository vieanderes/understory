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
  // Runs every step and hopes. A failure throws and undoes nothing.
  for (const step of steps) {
    await step.run();
    log.push(`ran ${step.name}`);
  }
  return { ok: true, log, stuck: [] };
}
