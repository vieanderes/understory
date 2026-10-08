import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { draftFacts, type Draft } from '@/core/planner';
import { AskBlock } from '@/features/tutor/planner/AskBlock';
import { DraftView } from '@/features/tutor/planner/DraftView';
import { paceLine, sizeLine } from '@/features/tutor/planner/facts';
import { PathCard } from '@/features/tutor/planner/PathCard';
import { PlanOffer } from '@/features/tutor/planner/PlanOffer';
import {
  draftFromOwnPath,
  draftKey,
  editDraft,
  isPlanRoute,
  markSaved,
  NEW_PLAN_HREF,
  planHref,
  resetPlanner,
  startPlanning,
  takeBlock,
} from '@/features/tutor/planner/planner-store';
import { appendMessage, readHistory } from '@/features/tutor/tutor-store';
import { readAssistantDraftForTest } from './draft-probe';
import type { PlannerCourse } from '@/features/tutor/planner/usePlannerCourse';

const push = vi.fn();
let pathname = '/paths';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), usePathname: () => pathname }));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const lesson = (id: string, minutes: number, prerequisites: string[] = []) => ({
  id,
  title: `Lesson ${id}`,
  objective: '',
  level: 'essential' as const,
  minutes,
  prerequisites,
  href: `/learn/x/${id}`,
});

const COURSE: PlannerCourse = {
  modules: [
    {
      id: 'web',
      number: 1,
      slug: 'web',
      title: 'Web',
      summary: '',
      youCanBuild: '',
      lessons: [lesson('web.http', 20), lesson('web.rest', 40, ['web.http'])],
    },
  ],
  parts: [],
};

const DRAFT: Draft = {
  name: 'Backend in six weeks',
  alternatives: ['Server side, ready'],
  summary: 'APIs first.',
  minutesPerWeek: 30,
  stages: [{ title: 'APIs', why: 'Where it starts.', lessonIds: ['web.rest'] }],
};

describe('AskBlock', () => {
  const ask = {
    question: 'What kind of interviews?',
    options: ['Coding', 'Design', 'Talk'],
    multi: false,
  };

  it('sends a single answer on the tap, and the box for anything else', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    const onOther = vi.fn();
    render(<AskBlock ask={ask} live onSend={onSend} onOther={onOther} />);
    expect(screen.getByRole('group', { name: 'What kind of interviews?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Design' }));
    expect(onSend).toHaveBeenCalledWith('Design');
    await user.click(screen.getByRole('button', { name: 'Something else' }));
    expect(onOther).toHaveBeenCalled();
  });

  it('collects several answers in the order offered, then sends them together', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<AskBlock ask={{ ...ask, multi: true }} live onSend={onSend} onOther={() => {}} />);
    const send = screen.getByRole('button', { name: 'Send' });
    expect(send).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Talk' }));
    await user.click(screen.getByRole('button', { name: 'Coding' }));
    expect(screen.getByRole('button', { name: 'Talk' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Send 2 answers' }));
    expect(onSend).toHaveBeenCalledWith('Coding, Talk');
  });

  it('shows what was picked on an earlier question, and takes no more taps', () => {
    render(
      <AskBlock
        ask={{ ...ask, multi: true }}
        live={false}
        answer="Coding, Talk"
        onSend={() => {}}
        onOther={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Coding' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Something else' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Send/ })).not.toBeInTheDocument();
  });
});

describe('a draft in words', () => {
  it('counts size and pace from the course, and the deadline', () => {
    const facts = draftFacts(DRAFT, COURSE, new Set());
    expect(sizeLine(DRAFT, facts)).toBe('1 stage · 1 lesson · about 40 min');
    expect(paceLine(DRAFT, facts, '2026-10-06')).toBe('About 2 weeks at 30 min a week.');
    expect(paceLine({ ...DRAFT, deadline: '2026-11-06' }, facts, '2026-10-06')).toBe(
      'About 2 weeks at 30 min a week, done before 6 Nov.',
    );
    expect(paceLine({ ...DRAFT, deadline: '2026-10-08' }, facts, '2026-10-06')).toBe(
      'About 2 weeks at 30 min a week. To finish by 8 Oct it needs 2 h 20 min a week.',
    );
    expect(
      paceLine(
        { ...DRAFT, minutesPerWeek: undefined, deadline: '2026-10-08' },
        facts,
        '2026-10-06',
      ),
    ).toBe('To finish by 8 Oct it needs 2 h 20 min a week.');
    expect(paceLine({ ...DRAFT, deadline: '2026-10-01' }, facts, '2026-10-06')).toContain(
      'has passed',
    );
    expect(paceLine({ ...DRAFT, minutesPerWeek: undefined }, facts, '2026-10-06')).toBeUndefined();
    const done = draftFacts(DRAFT, COURSE, new Set(['web.rest']));
    expect(paceLine(DRAFT, done, '2026-10-06')).toBe('Every lesson in it is done.');
  });
});

describe('PathCard', () => {
  const props = {
    draft: DRAFT,
    facts: draftFacts(DRAFT, COURSE, new Set()),
    today: '2026-10-06',
    current: true,
    saved: false,
    saving: false,
    edited: false,
    dropped: 2,
    onOpen: vi.fn(),
    onSave: vi.fn(),
    onFollow: vi.fn(),
  };

  it('shows the newest draft with its gaps, and the two actions', async () => {
    const user = userEvent.setup();
    render(<PathCard {...props} />);
    const card = screen.getByRole('article', { name: 'Draft path: Backend in six weeks' });
    expect(card).toHaveTextContent('1 lesson it builds on is missing');
    expect(card).toHaveTextContent('Left out 2 lessons the course does not have.');
    await user.click(screen.getByRole('button', { name: 'Save path' }));
    expect(props.onSave).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Open draft' }));
    expect(props.onOpen).toHaveBeenCalled();
  });

  it('links to Learn once saved, offers to save changes after, and keeps earlier drafts short', () => {
    const { rerender } = render(<PathCard {...props} saved savedHref="/paths?path=own-a1b2c3d4" />);
    expect(screen.getByRole('link', { name: 'Saved. Open on Learn' })).toHaveAttribute(
      'href',
      '/paths?path=own-a1b2c3d4',
    );
    rerender(<PathCard {...props} edited savedHref="/paths?path=own-a1b2c3d4" />);
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
    expect(screen.getByText('Draft, edited')).toBeInTheDocument();
    rerender(<PathCard {...props} current={false} />);
    expect(screen.getByText('Earlier draft')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('DraftView', () => {
  const setup = (draft: Draft = DRAFT) => {
    const onChange = vi.fn();
    render(
      <DraftView
        draft={draft}
        facts={draftFacts(draft, COURSE, new Set())}
        course={COURSE}
        completed={new Set()}
        today="2026-10-06"
        saved={false}
        saving={false}
        onChange={onChange}
        onSave={() => {}}
        onBack={() => {}}
        onFollow={() => {}}
      />,
    );
    return onChange;
  };

  it('adds what the path builds on, as advice', async () => {
    const user = userEvent.setup();
    const onChange = setup();
    expect(screen.getByText('It builds on 1 lesson you have not done')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add it' }));
    expect(onChange.mock.calls[0]![0].stages[0].lessonIds).toEqual(['web.http', 'web.rest']);
  });

  it('renames when the field is left, in the house style, and offers the other names', async () => {
    const user = userEvent.setup();
    const onChange = setup();
    const field = screen.getByLabelText('Name');
    await user.clear(field);
    await user.type(field, 'Ship it!');
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(field);
    expect(onChange.mock.calls[0]![0].name).toBe('Ship it');
    await user.click(screen.getByRole('button', { name: 'Server side, ready' }));
    expect(onChange.mock.calls.at(-1)![0]).toMatchObject({
      name: 'Server side, ready',
      alternatives: ['Backend in six weeks'],
    });
  });

  it('removes a lesson, but never the last one', async () => {
    const user = userEvent.setup();
    const two: Draft = {
      ...DRAFT,
      stages: [{ title: 'APIs', why: '', lessonIds: ['web.http', 'web.rest'] }],
    };
    const onChange = setup(two);
    expect(screen.queryByRole('button', { name: 'Remove the stage APIs' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove Lesson web.http' }));
    expect(onChange.mock.calls[0]![0].stages[0].lessonIds).toEqual(['web.rest']);
  });

  it('shows the destination, each milestone and the cutlist, and brings a cut back in order', async () => {
    const user = userEvent.setup();
    const onChange = setup({
      ...DRAFT,
      destination: 'Ship a small REST API',
      baseline: 'Writes scripts.',
      cut: [
        { what: 'HTTP basics', why: 'Known already.', later: true, lessonIds: ['web.http'] },
        { what: 'Kubernetes', why: 'One service needs none.', later: false, lessonIds: [] },
      ],
      stages: [
        {
          title: 'APIs',
          why: '',
          lessonIds: ['web.rest'],
          milestone: { output: 'An API that rejects bad input', check: 'Its tests pass' },
        },
      ],
    });
    expect(screen.getByText('Ship a small REST API')).toBeInTheDocument();
    expect(screen.getByText('Starting from: Writes scripts.')).toBeInTheDocument();
    expect(screen.getByText('An API that rejects bad input')).toBeInTheDocument();
    expect(screen.getByText('Left out for now · 2')).toBeInTheDocument();
    expect(screen.getByText(/Not needed for this destination/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Bring back' })).toHaveLength(1);
    await user.click(screen.getByText('Left out for now · 2'));
    await user.click(screen.getByRole('button', { name: 'Bring back' }));
    const next = onChange.mock.calls[0]![0] as Draft;
    expect(next.cut?.map((c) => c.what)).toEqual(['Kubernetes']);
    expect(next.stages.flatMap((st) => st.lessonIds)).toEqual(['web.http', 'web.rest']);
  });
});

describe('the planner store', () => {
  it('takes a new draft over hand edits, and knows when the draft is saved', () => {
    resetPlanner();
    editDraft(DRAFT);
    const block = {
      name: 'B',
      alternatives: [],
      summary: '',
      stages: [{ title: 'S', why: '', lessons: ['web.http'] }],
    };
    takeBlock(block);
    const stored = JSON.parse(window.localStorage.getItem('understory:planner') ?? '{}');
    expect(stored).toEqual({ block });
    markSaved('own-a1b2c3d4', DRAFT);
    expect(JSON.parse(window.localStorage.getItem('understory:planner') ?? '{}').savedAs).toBe(
      draftKey(DRAFT),
    );
    const undo = resetPlanner();
    expect(window.localStorage.getItem('understory:planner')).toBe('{}');
    undo();
    expect(JSON.parse(window.localStorage.getItem('understory:planner') ?? '{}').pathId).toBe(
      'own-a1b2c3d4',
    );
  });

  it('plans an own path again from its stages, or its lessons when it has none', () => {
    expect(
      draftFromOwnPath({
        id: 'custom',
        name: 'My path',
        lessonIds: ['web.http'],
        origin: 'builder',
      }).stages,
    ).toEqual([{ title: 'Your lessons', why: '', lessonIds: ['web.http'] }]);
    expect(
      draftFromOwnPath({
        id: 'own-a1b2c3d4',
        name: 'B',
        lessonIds: ['web.http'],
        stages: [{ title: 'S', lessonIds: ['web.http'] }],
        pace: { minutesPerWeek: 60, deadline: '2026-11-01' },
        origin: 'scout',
      }),
    ).toMatchObject({
      minutesPerWeek: 60,
      deadline: '2026-11-01',
      stages: [{ title: 'S', why: '' }],
    });
  });
});

describe('where Scout plans', () => {
  it('plans only in the builder, which the other entries link to', () => {
    expect(isPlanRoute('/learn/build')).toBe(true);
    expect(isPlanRoute('/paths')).toBe(false);
    expect(isPlanRoute('/learn/javascript/maps')).toBe(false);
    expect(planHref()).toBe('/learn/build?plan=1');
    expect(planHref('own-a1b2c3d4')).toBe('/learn/build?path=own-a1b2c3d4&plan=1');
    expect(NEW_PLAN_HREF).toBe('/learn/build?plan=new');
  });

  it('starts a new planning conversation from the builder, saving back to the path edited', () => {
    appendMessage('planner', { role: 'user', text: 'Old plan', at: 1 });
    startPlanning(DRAFT, { id: 'own-a1b2c3d4', name: 'Backend' });
    expect(readHistory('planner')).toEqual([]);
    const stored = JSON.parse(window.localStorage.getItem('understory:planner') ?? '{}');
    expect(stored).toMatchObject({
      edited: DRAFT,
      pathId: 'own-a1b2c3d4',
      seedName: 'Backend',
      savedAs: draftKey(DRAFT),
    });
    startPlanning(undefined);
    expect(window.localStorage.getItem('understory:planner')).toBe('{}');
  });
});

describe('PlanOffer', () => {
  it('takes the learner to the builder on a new plan, their words in the question box', async () => {
    const user = userEvent.setup();
    pathname = '/paths';
    render(<PlanOffer body='{"brief":"Backend interviews in six weeks"}' live />);
    await user.click(screen.getByRole('button', { name: /Plan it with Scout/ }));
    expect(push).toHaveBeenCalledWith('/learn/build?plan=new');
    expect(readAssistantDraftForTest()).toBe('Backend interviews in six weeks');
  });

  it('starts planning in place on the builder, and draws nothing for a broken block', async () => {
    const user = userEvent.setup();
    pathname = '/learn/build';
    push.mockClear();
    const { container, rerender } = render(<PlanOffer body="" live />);
    await user.click(screen.getByRole('button', { name: /Plan it with Scout/ }));
    expect(push).not.toHaveBeenCalled();
    rerender(<PlanOffer body="not json" live />);
    expect(container).toBeEmptyDOMElement();
  });
});
