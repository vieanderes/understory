import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanAnswers, PlanCatalog } from '@/core/plan';

let plan: PlanAnswers | undefined;
let completed = new Set<string>();
const record = vi.fn(async () => undefined);
vi.mock('@/features/store/StoreProvider', () => ({
  useProgress: () => ({
    status: 'ready',
    state: { plan, completedLessons: completed, onlineTests: [], pathExams: {} },
  }),
  useStore: () => ({ record }),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { PlanSetup } = await import('@/features/plan/PlanSetup');
const { PlanView } = await import('@/features/plan/PlanView');

const lessons = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `${prefix}.${i + 1}`,
    title: `${prefix} lesson ${i + 1}`,
    minutes: 10,
    href: `/learn/${prefix}/${i + 1}`,
  }));

const CATALOG: PlanCatalog = {
  paths: [
    {
      id: 'start-coding',
      name: 'Start coding',
      stages: [{ title: 'A', lessons: lessons('basics', 3) }],
    },
    {
      id: 'javascript-typescript',
      name: 'JS',
      stages: [{ title: 'A', lessons: lessons('js', 2) }],
    },
    { id: 'python', name: 'Python', stages: [{ title: 'A', lessons: lessons('py', 2) }] },
    {
      id: 'coding-rounds',
      name: 'Algorithms',
      stages: [{ title: 'A', lessons: lessons('algo', 2) }],
    },
  ],
  parts: [],
  tests: [{ key: 'demo', title: 'Demo test', minutes: 30 }],
};

beforeEach(() => {
  plan = undefined;
  completed = new Set();
  record.mockClear();
});

describe('PlanSetup', () => {
  it('asks five short questions, shows the plan, then saves the answers and the profile', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<PlanSetup catalog={CATALOG} onDone={onDone} />);
    expect(screen.getByRole('heading', { name: 'What would you like to do?' })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /Learn to code from scratch/ }));
    expect(
      screen.getByRole('heading', { name: 'What are you interested in?' }),
    ).toBeInTheDocument();
    // The goal suggests its interests; one more is added.
    expect(screen.getByRole('button', { name: 'Coding basics' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Python' }));
    await user.click(screen.getByRole('button', { name: /Next/ }));
    await user.click(screen.getByRole('radio', { name: 'Python' }));
    await user.click(screen.getByRole('button', { name: /Next/ }));
    expect(
      screen.getByRole('heading', { name: 'How much time do you have a day?' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: '1½ h' }));
    await user.click(screen.getByRole('button', { name: /Next/ }));
    await user.click(screen.getByRole('radio', { name: 'No' }));
    await user.click(screen.getByRole('button', { name: /Next/ }));
    expect(screen.getByRole('heading', { name: 'Your plan' })).toBeInTheDocument();
    expect(screen.getByText('Python properly')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(record).toHaveBeenCalledWith('profile_set', {
      interests: ['basics', 'web', 'python'],
      news: false,
    });
    expect(record).toHaveBeenCalledWith(
      'plan_set',
      expect.objectContaining({
        goal: 'from-zero',
        level: 'new',
        language: 'python',
        minutesPerWeek: 630,
      }),
    );
    expect(onDone).toHaveBeenCalled();
  });

  it('asks what to specialise in, and keeps the order the focus was tapped', async () => {
    const user = userEvent.setup();
    render(<PlanSetup catalog={CATALOG} onDone={() => {}} />);
    await user.click(screen.getByRole('radio', { name: /Refresh, then specialise/ }));
    expect(
      screen.getByRole('heading', { name: 'What would you like to specialise in?' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'System design' }));
    await user.click(screen.getByRole('button', { name: 'AI engineering' }));
    for (let i = 0; i < 4; i++) await user.click(screen.getByRole('button', { name: /Next/ }));
    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(record).toHaveBeenCalledWith(
      'plan_set',
      expect.objectContaining({ goal: 'refresh-specialise', focus: ['systems', 'ai'] }),
    );
  });

  it('ends after the interests for the news alone, with no plan', async () => {
    const user = userEvent.setup();
    render(<PlanSetup catalog={CATALOG} onDone={() => {}} />);
    await user.click(screen.getByRole('radio', { name: /Just follow the news/ }));
    await user.click(screen.getByRole('button', { name: 'Show me the news' }));
    expect(record).toHaveBeenCalledWith('profile_set', { interests: [], news: true });
    expect(record).not.toHaveBeenCalledWith('plan_set', expect.anything());
  });

  it('asks for the date for interviews, and waits for a valid one', async () => {
    const user = userEvent.setup();
    render(<PlanSetup catalog={CATALOG} onDone={() => {}} initialGoal="interviews" />);
    await user.click(screen.getByRole('button', { name: /Next/ }));
    await user.click(screen.getByRole('button', { name: /Next/ }));
    expect(screen.getByLabelText('The interview or test is on')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Next/ })).toBeDisabled();
  });
});

describe('PlanView', () => {
  it('shows today’s step, the phases and what is done, and can be changed or cleared', async () => {
    plan = {
      goal: 'from-zero',
      level: 'new',
      language: 'js',
      minutesPerWeek: 210,
      since: '2026-09-01',
    };
    completed = new Set(['basics.1']);
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PlanView catalog={CATALOG} onChange={onChange} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Learn to code from scratch',
    );
    expect(screen.getByRole('heading', { name: 'basics lesson 2' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Start · 10 min/ })).toHaveAttribute(
      'href',
      '/learn/basics/2',
    );
    expect(screen.getByText('First programs')).toBeInTheDocument();
    expect(screen.getAllByLabelText('done')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Change my plan' }));
    expect(onChange).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Clear the plan' }));
    await user.click(screen.getByRole('button', { name: 'Clear it' }));
    expect(record).toHaveBeenCalledWith('plan_cleared', {});
  });
});
