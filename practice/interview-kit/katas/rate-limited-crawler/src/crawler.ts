import type { PageResult } from '../fixtures/fake-site';

export interface CrawlOptions {
  startUrl: string;
  fetchPage: (url: string) => Promise<PageResult>;
  maxConcurrency: number;
  maxDepth: number;
  perHostIntervalMs: number;
  allowedHosts?: string[];
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export interface CrawledPage {
  url: string;
  depth: number;
  status: number;
}

export interface CrawlError {
  url: string;
  message: string;
}

export interface CrawlResult {
  pages: CrawledPage[];
  errors: CrawlError[];
}

export async function crawl(options: CrawlOptions): Promise<CrawlResult> {
  void options;
  throw new Error('Not implemented');
}
