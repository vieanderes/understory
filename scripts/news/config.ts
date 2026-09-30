import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { interestsSchema, type Interests, type LessonIndexEntry } from '@/core/news';

/*
 * Reads the two hand-edited files that steer Signal: content/feeds.yaml (where to look)
 * and content/interests.yaml (what the reader cares about). Both are validated on every
 * run, so a typo stops the run with a message instead of skewing a week of news.
 */

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Lowercase words joined by hyphens.');

export const feedSchema = z.strictObject({
  id: slug,
  name: z.string().trim().min(1),
  url: z.string().regex(/^https:\/\/\S+$/, 'Feeds are fetched over https only.'),
  weight: z.number().min(0).max(1),
  topics: z.array(slug).min(1),
});

export const feedsFileSchema = z
  .strictObject({ feeds: z.array(feedSchema).min(1) })
  .superRefine((file, ctx) => {
    const seen = new Set<string>();
    file.feeds.forEach((feed, index) => {
      if (seen.has(feed.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate feed id "${feed.id}".`,
          path: ['feeds', index, 'id'],
        });
      }
      seen.add(feed.id);
    });
  });

export type FeedConfig = z.infer<typeof feedSchema>;

export interface SignalConfig {
  feeds: FeedConfig[];
  interests: Interests;
  lessonIndex: LessonIndexEntry[];
}

function describe(error: z.ZodError): string {
  return error.issues.map((issue) => `  ${issue.path.join('.')}: ${issue.message}`).join('\n');
}

async function readYamlFile<T>(file: string, schema: z.ZodType<T>): Promise<T> {
  const result = schema.safeParse(parseYaml(await readFile(file, 'utf8')));
  if (!result.success) throw new Error(`${file} is not valid:\n${describe(result.error)}`);
  return result.data;
}

export async function loadConfig(root: string): Promise<SignalConfig> {
  const { feeds } = await readYamlFile(path.join(root, 'content', 'feeds.yaml'), feedsFileSchema);
  const interests = await readYamlFile(
    path.join(root, 'content', 'interests.yaml'),
    interestsSchema,
  );

  const topicIds = new Set(interests.topics.map((topic) => topic.id));
  for (const feed of feeds) {
    const unknown = feed.topics.filter((topic) => !topicIds.has(topic));
    if (unknown.length > 0) {
      throw new Error(`feeds.yaml: feed "${feed.id}" names unknown topics: ${unknown.join(', ')}.`);
    }
  }

  // A feed's weight lives next to its URL. An explicit entry in interests.yaml still wins.
  const feedWeights = Object.fromEntries(feeds.map((feed) => [feed.id, feed.weight]));
  const merged: Interests = {
    ...interests,
    sourceWeights: {
      ...interests.sourceWeights,
      ids: { ...feedWeights, ...interests.sourceWeights.ids },
    },
  };
  // The lesson index is written ahead of the lessons, from docs/CURRICULUM.md. An id that
  // has no lesson yet is kept: the app resolves ids against the content manifest and shows
  // only the ones that exist, and the link appears by itself once the lesson is published.
  return { feeds, interests: merged, lessonIndex: merged.lessons };
}
