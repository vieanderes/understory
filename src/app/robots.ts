import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/**
 * Crawlers that collect text to train models. Search engines stay welcome, so learners can
 * find the site; these get nothing. robots.txt is a request, not a lock: the
 * `tdm-reservation` header (next.config.ts) carries the legal opt-out.
 */
export const AI_TRAINING_CRAWLERS = [
  'GPTBot',
  'ClaudeBot',
  'anthropic-ai',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'Bytespider',
  'Amazonbot',
  'meta-externalagent',
  'FacebookBot',
  'cohere-ai',
  'cohere-training-data-crawler',
  'Diffbot',
  'omgili',
  'ImagesiftBot',
  'YouBot',
  'Timpibot',
  'AI2Bot',
];

/**
 * AI search and answer engines fetch a page to cite and link it, the way a search engine
 * does. Learners increasingly ask an assistant where to learn, so these may read the pages;
 * they get the same rule as search engines.
 */
export const AI_SEARCH_CRAWLERS = [
  'OAI-SearchBot',
  'ChatGPT-User',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'DuckAssistBot',
  'MistralAI-User',
];

// The content bundle is what the pages render. Search engines index the pages, not the raw
// lesson files.
const PRIVATE = ['/dev/', '/sandbox/', '/content/'];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: AI_TRAINING_CRAWLERS, disallow: '/' },
      { userAgent: AI_SEARCH_CRAWLERS, allow: '/', disallow: PRIVATE },
      { userAgent: '*', allow: '/', disallow: PRIVATE },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
