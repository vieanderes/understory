import { journey, scenarioById } from '@/core/labs/request-journey';
import { Timeline } from '@/features/labs/request-journey/Timeline';

/** A finished run of the request journey lab: where the milliseconds went, hop by hop. */
export function RequestHops({ scenario }: { scenario: 'first-visit' | 'second-visit' }) {
  const run = journey(scenarioById(scenario)!.input);
  return (
    <Timeline
      run={run}
      index={run.frames.length - 1}
      revealed
      previousTotalMs={null}
      heading={false}
    />
  );
}
