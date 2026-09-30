import { describe, expect, it } from 'vitest';
import { feedsFileSchema, loadConfig } from '../../../../scripts/news/config';
import { REPO_ROOT } from './helpers';

describe('content/feeds.yaml and content/interests.yaml', () => {
  it('load and validate', async () => {
    const config = await loadConfig(REPO_ROOT);
    expect(config.feeds.length).toBeGreaterThanOrEqual(25);
    expect(config.interests.topics.length).toBeGreaterThanOrEqual(10);
    expect(config.lessonIndex.length).toBeGreaterThan(50);
  });

  it('give every feed a weight the scorer can find', async () => {
    const { feeds, interests } = await loadConfig(REPO_ROOT);
    for (const feed of feeds) expect(interests.sourceWeights.ids[feed.id]).toBe(feed.weight);
  });

  it('use each lesson id once', async () => {
    const { lessonIndex } = await loadConfig(REPO_ROOT);
    const ids = lessonIndex.map((lesson) => lesson.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keep the copy rules: no em-dashes and no exclamation marks in what the app shows', async () => {
    const { interests } = await loadConfig(REPO_ROOT);
    const shown = [
      ...interests.topics.flatMap((topic) => [topic.label, topic.why]),
      ...interests.glossary.flatMap((entry) => [entry.term, entry.explanation]),
    ];
    for (const text of shown) expect(text).not.toMatch(/[—!]/);
  });
});

describe('feedsFileSchema', () => {
  const feed = {
    id: 'a',
    name: 'A',
    url: 'https://a.example/feed',
    weight: 0.5,
    topics: ['security'],
  };

  it('rejects duplicate ids', () => {
    expect(feedsFileSchema.safeParse({ feeds: [feed, feed] }).success).toBe(false);
  });

  it('rejects plain http and unknown keys', () => {
    expect(
      feedsFileSchema.safeParse({ feeds: [{ ...feed, url: 'http://a.example/feed' }] }).success,
    ).toBe(false);
    expect(feedsFileSchema.safeParse({ feeds: [{ ...feed, wieght: 1 }] }).success).toBe(false);
  });
});
