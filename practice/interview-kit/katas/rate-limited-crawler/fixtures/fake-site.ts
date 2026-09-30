/**
 * An in-process website. Each page lists its links and how long it takes to respond.
 * The site records what a real server's logs would show, so tests can check politeness.
 */

export interface FakePage {
  links?: string[];
  status?: number;
  delayMs?: number;
  /** Throw instead of responding, like a dropped connection. */
  fail?: string;
}

export interface PageResult {
  status: number;
  links: string[];
}

export interface FakeSite {
  fetchPage(url: string): Promise<PageResult>;
  /** Every requested URL, in the order requests started. */
  readonly requests: string[];
  /** Start times per host, from Date.now(). */
  readonly startsByHost: Map<string, number[]>;
  peakInFlight(): number;
}

export function createFakeSite(pages: Record<string, FakePage>, defaultDelayMs = 100): FakeSite {
  const requests: string[] = [];
  const startsByHost = new Map<string, number[]>();
  let inFlight = 0;
  let peak = 0;

  async function fetchPage(url: string): Promise<PageResult> {
    requests.push(url);
    const host = new URL(url).host;
    startsByHost.set(host, [...(startsByHost.get(host) ?? []), Date.now()]);
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    const page = pages[url];
    try {
      await new Promise((resolve) => setTimeout(resolve, page?.delayMs ?? defaultDelayMs));
      if (!page) return { status: 404, links: [] };
      if (page.fail) throw new Error(page.fail);
      return { status: page.status ?? 200, links: page.links ?? [] };
    } finally {
      inFlight -= 1;
    }
  }

  return { fetchPage, requests, startsByHost, peakInFlight: () => peak };
}
