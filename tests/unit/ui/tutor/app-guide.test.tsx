import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LIBRARY, PLACES } from '@/components/layout/nav';
import { initialProgressState, type ProgressState } from '@/core/progress';
import type { CatalogFile } from '@/core/practice';
import { inAppHref, Markdown } from '@/features/online-test/assistant/Markdown';
import { buildAppGuide, LIBRARY_SHELVES, SETTINGS_HREF } from '@/features/tutor/app-guide';
import { learnerSituation, type PathIndexEntry } from '@/features/tutor/learner-situation';
import { pageGuide } from '@/features/tutor/page-guide';

/** Rough token count: about four characters a token for English prose. */
const tokens = (text: string) => Math.ceil(text.length / 4);

describe('the app guide Scout carries on every page', () => {
  const guide = buildAppGuide({ pathname: '/settings' });

  it('names every place in the navigation with its route, in tab order', () => {
    let at = -1;
    for (const place of PLACES) {
      const index = guide.indexOf(`${place.label} (${place.href})`);
      expect(index, place.label).toBeGreaterThan(at);
      at = index;
    }
  });

  it('names the library, its shelves and settings, and how to reach them on each screen', () => {
    expect(guide).toContain(`${LIBRARY.label} (${LIBRARY.href})`);
    for (const [, href] of LIBRARY_SHELVES) expect(guide).toContain(`(${href})`);
    expect(guide).toContain(`Settings (${SETTINGS_HREF})`);
    expect(guide).toContain('/plan?edit');
    expect(guide).toMatch(/on a phone they are the tabs at the bottom/i);
    expect(guide).toMatch(/on desktop the rail on the left/i);
    expect(guide).toContain('The learner is on /settings.');
  });

  it('stays compact, a few hundred tokens with the situation', () => {
    const full = buildAppGuide({
      pathname: '/settings',
      situation: {
        goal: 'Become an AI engineer',
        interests: ['AI and LLMs', 'Python'],
        path: {
          name: 'AI engineering',
          done: 3,
          total: 24,
          next: { title: 'Calling a model', href: '/learn/ai/calling?path=ai' },
        },
        due: 4,
        lastTest: { title: 'Practice test 1', score: 72 },
        news: { date: '2026-10-06', read: false },
      },
    });
    expect(tokens(full)).toBeLessThan(800);
  });

  it('follows the house style: no em-dashes and no exclamation marks', () => {
    expect(guide).not.toMatch(/—|!/);
  });
});

describe('the learner situation', () => {
  const paths: PathIndexEntry[] = [
    { id: 'start-coding', name: 'Start coding', lessonIds: ['basics.a', 'basics.b'] },
    { id: 'python', name: 'Python', lessonIds: ['py.a', 'py.b', 'py.c'] },
  ];
  const catalog = {
    parts: [{ lessons: ['basics.a', 'basics.b', 'py.a', 'py.b', 'py.c'] }],
    lessons: {
      'py.b': { title: 'Functions', moduleSlug: 'python', slug: 'functions' },
    },
  } as unknown as CatalogFile;
  const state = (over: Partial<ProgressState>): ProgressState => ({
    ...initialProgressState(),
    ...over,
  });

  it('says only that there is no plan or path for a newcomer', () => {
    const s = learnerSituation({ state: state({}), paths, catalog: null });
    expect(s).toEqual({ interests: [] });
    const text = buildAppGuide({ pathname: '/', situation: s });
    expect(text).toContain('No plan yet');
    expect(text).toContain('No path under way');
  });

  it('finds the path under way, its next lesson, what is due, the last test and the news', () => {
    const s = learnerSituation({
      state: state({
        plan: {
          goal: 'ai-engineer',
          level: 'some',
          language: 'python',
          minutesPerWeek: 120,
          since: '2026-10-01',
        } as ProgressState['plan'],
        profile: { interests: ['python'], news: true } as ProgressState['profile'],
        completedLessons: new Set(['py.a']),
        newsRead: new Set(['2026-10-05']),
        onlineTests: [
          {
            title: 'Practice test 1',
            tasks: [
              {
                type: 'coding',
                correctness: { passed: 3, total: 4 },
                performance: { passed: 0, total: 0 },
              },
            ],
          },
        ] as unknown as ProgressState['onlineTests'],
      }),
      paths,
      catalog,
      due: 5,
      latestNews: '2026-10-06',
    });
    expect(s.goal).toBe('Become an AI engineer');
    expect(s.interests).toEqual(['Python']);
    expect(s.path).toEqual({
      name: 'Python',
      done: 1,
      total: 3,
      next: { title: 'Functions', href: '/learn/python/functions?path=python' },
    });
    expect(s.due).toBe(5);
    expect(s.lastTest?.title).toBe('Practice test 1');
    expect(s.news).toEqual({ date: '2026-10-06', read: false });
    const text = buildAppGuide({ pathname: '/', situation: s });
    expect(text).toContain('Next lesson: Functions (/learn/python/functions?path=python)');
    expect(text).toContain('5 review cards due');
    expect(text).toContain('unread');
  });

  it('prefers the path the learner chose, their own path included', () => {
    const s = learnerSituation({
      state: state({
        settings: { 'learn.path': 'custom' },
        customPath: ['py.c', 'basics.b'],
      }),
      paths,
      catalog,
    });
    expect(s.path?.name).toBe('My path');
    expect(s.path?.total).toBe(2);
  });
});

describe('page guides', () => {
  it('covers the new places and pages', () => {
    expect(pageGuide('/').title).toBe('Home');
    expect(pageGuide('/paths').title).toBe('Learn');
    expect(pageGuide('/practise').title).toBe('Practice');
    expect(pageGuide('/practise/online-test').title).toBe('Coding tests');
    expect(pageGuide('/signal').title).toBe('News');
    expect(pageGuide('/library').title).toBe('Library');
    expect(pageGuide('/learn/build').title).toBe('Build your own path');
    expect(pageGuide('/plan').title).toBe('Your plan');
    expect(pageGuide('/settings').title).toBe('Settings');
    expect(pageGuide('/progress').title).toBe('Progress');
  });

  it('no longer speaks of Review or Paths as places', () => {
    for (const path of ['/', '/paths', '/practise', '/practise/online-test', '/settings']) {
      const guide = pageGuide(path);
      expect(guide.title).not.toMatch(/^(Review|Paths)$/);
      expect(guide.offers).not.toMatch(/\bReview\b/);
    }
  });
});

describe('links in Scout replies', () => {
  it('accepts paths in the app and nothing that leaves it', () => {
    expect(inAppHref('/signal')).toBe('/signal');
    expect(inAppHref('/plan?edit')).toBe('/plan?edit');
    expect(inAppHref('/signal/2026-10-06#story-1')).toBe('/signal/2026-10-06#story-1');
    for (const bad of [
      '//evil.example',
      '/\\evil.example',
      'javascript:alert(1)',
      'https://evil.example',
      'signal',
      '/sig nal',
    ]) {
      expect(inAppHref(bad), bad).toBeNull();
    }
  });

  it('renders relative links as in-app links only where they are allowed', () => {
    const { unmount } = render(<Markdown text="Open [News](/signal)." links={{}} />);
    const link = screen.getByRole('link', { name: 'News' });
    expect(link).toHaveAttribute('href', '/signal');
    expect(link).not.toHaveAttribute('target');
    unmount();
    // In a test the assistant keeps the candidate on the task: the words stay, no link.
    render(<Markdown text="Open [News](/signal)." />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText(/\[News\]\(\/signal\)/)).toBeInTheDocument();
  });

  it('never links a protocol-relative path, even where links are allowed', () => {
    render(<Markdown text="[x](//evil.example)" links={{}} />);
    expect(screen.queryByRole('link')).toBeNull();
  });
});
