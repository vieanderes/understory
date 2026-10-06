import { describe, expect, it } from 'vitest';
import { taskFileSchema, TOPIC_LABEL, TOPICS } from '@/core/online-test/schema';

describe('online-test topics', () => {
  it('covers the engineering families beyond the algorithm syllabus', () => {
    for (const topic of [
      'api-integration',
      'reliability',
      'data-sync',
      'ai-systems',
      'agents',
      'evals',
    ]) {
      expect(TOPICS).toContain(topic);
    }
  });

  it('labels every topic once, in sentence case, without a dash', () => {
    expect(Object.keys(TOPIC_LABEL).sort()).toEqual([...TOPICS].sort());
    const labels = Object.values(TOPIC_LABEL);
    expect(new Set(labels).size).toBe(labels.length);
    for (const label of labels) expect(label).toMatch(/^[A-Z][^—!]*$/);
    expect(TOPIC_LABEL['api-integration']).toBe('API integration');
    expect(TOPIC_LABEL['ai-systems']).toBe('AI systems');
  });

  it('lets a task file name a new topic', () => {
    expect(taskFileSchema.shape.topic.safeParse('evals').success).toBe(true);
    expect(taskFileSchema.shape.topic.safeParse('vibes').success).toBe(false);
  });
});
