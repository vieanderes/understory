import { describe, expect, it } from 'vitest';
import { plannerSituation, type Draft } from '@/core/planner';

const draft: Draft = {
  name: 'Backend in six weeks',
  alternatives: [],
  summary: '',
  minutesPerWeek: 240,
  stages: [
    { title: 'HTTP', why: 'First.', lessonIds: ['web.http', 'web.rest'] },
    { title: 'SQL', why: '', lessonIds: ['db.select'] },
  ],
};

describe('what Scout knows about the learner while planning', () => {
  it('says the date, the setup answers, what is done and their paths', () => {
    const text = plannerSituation({
      today: '2026-10-06',
      setup: {
        goal: 'Get a first job',
        level: 'some',
        language: 'python',
        minutesPerWeek: 300,
        deadline: '2026-12-01',
      },
      interests: ['Web', 'AI'],
      done: [
        { chapter: 'First steps', id: 'basics', done: 14, total: 14 },
        { chapter: 'Web', id: 'web', done: 0, total: 12 },
        { chapter: 'SQL', id: 'db', done: 3, total: 10 },
      ],
      lessons: 370,
      ownPaths: ['Weekend Python'],
    });
    expect(text).toContain('Today is 2026-10-06.');
    expect(text).toContain(
      'From setup: goal Get a first job; has written some code; prefers Python; 300 minutes a week; deadline 2026-12-01.',
    );
    expect(text).toContain('Interests: Web, AI.');
    expect(text).toContain('Lessons done: 17 of 370.');
    expect(text).toContain('- First steps (basics): all 14');
    expect(text).toContain('- SQL (db): 3 of 10');
    expect(text).not.toContain('Web (web)');
    expect(text).toContain('Paths they already made: Weekend Python.');
    expect(text).toContain('No draft yet.');
  });

  it('shows the draft as they see it, and says when they changed it', () => {
    const text = plannerSituation({
      today: '2026-10-06',
      done: [],
      lessons: 370,
      draft,
      edited: true,
    });
    expect(text).toContain('Lessons done: none yet.');
    expect(text).toContain('Current draft, edited by the learner: start from this one.');
    expect(text).toContain('Name: Backend in six weeks. Pace: 240 minutes a week.');
    expect(text).toContain('- HTTP: web.http, web.rest');
    expect(text).toContain('- SQL: db.select');
    const plain = plannerSituation({
      today: '2026-10-06',
      done: [],
      lessons: 1,
      draft: { ...draft, minutesPerWeek: undefined, deadline: '2026-11-01' },
    });
    expect(plain).toContain('Current draft:');
    expect(plain).toContain('Name: Backend in six weeks. Deadline: 2026-11-01.');
  });

  it('says when the draft is saved', () => {
    const text = plannerSituation({
      today: '2026-10-06',
      done: [],
      lessons: 1,
      draft,
      saved: true,
    });
    expect(text).toContain(
      'It is saved as one of their paths; changes are saved again when they press Save.',
    );
  });
});
