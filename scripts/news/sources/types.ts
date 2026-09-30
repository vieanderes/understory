import type { Interests, RawItem } from '@/core/news';
import type { HttpDeps } from '../http';

/** What every source adapter is given. Nothing here is global, so tests can fake all of it. */
export interface SourceContext extends HttpDeps {
  now: Date;
  interests: Interests;
}

/**
 * One place news comes from. `fetch` either returns items or throws. The pipeline turns a
 * throw into a failed line in the run report and carries on with the other sources.
 */
export interface Source {
  id: string;
  fetch(ctx: SourceContext): Promise<RawItem[]>;
}
