import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/**
 * Crawlers that collect text to train or ground AI models. Search engines stay welcome, so
 * learners can find the site; these get nothing. robots.txt is a request, not a lock: the
 * `tdm-reservation` header (next.config.ts) carries the legal opt-out.
 */
export const AI_CRAWLERS = [
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'anthropic-ai',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'PerplexityBot',
  'Perplexity-User',
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
  'DuckAssistBot',
  'MistralAI-User',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: AI_CRAWLERS, disallow: '/' },
      // The content bundle is what the pages render. Search engines index the pages, not
      // the raw lesson files.
      { userAgent: '*', allow: '/', disallow: ['/dev/', '/sandbox/', '/content/'] },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
