import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import CacheLayerExplorer from '@/features/labs/cache-layer-explorer';
import {
  LESSON_SCENARIO_ID,
  parseCall,
  parsePreset,
} from '@/features/labs/cache-layer-explorer/preset';

type User = ReturnType<typeof userEvent.setup>;

const step = () => screen.getByRole('button', { name: /^Step$/ });
const rowFor = (name: RegExp) => screen.getByRole('rowheader', { name }).closest('tr');

async function stepTimes(user: User, times: number) {
  for (let i = 0; i < times; i += 1) await user.click(step());
}

/** The preset the data fetching and caching lesson sets on its lab step. */
const LESSON_PRESET = {
  route: '/menu',
  cacheLife: 'max',
  cacheTag: 'menu',
  stores: ['request-memo', 'use-cache-entry', 'prerendered-page', 'client-router-cache'],
  timeline: [
    { event: 'build' },
    { event: 'visit', actor: 'A', path: '/menu' },
    { event: 'navigate', actor: 'A', path: '/order' },
    { event: 'action', call: "updateTag('menu')" },
    { event: 'back', actor: 'A' },
    { event: 'visit', actor: 'B', path: '/menu' },
  ],
};

describe('CacheLayerExplorer', () => {
  it('renders the question, the plan, the stores and what to predict', () => {
    render(<CacheLayerExplorer />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Cache-layer explorer' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/two people open the same page/)).toBeInTheDocument();
    expect(screen.getAllByTestId('timeline-step')).toHaveLength(4);
    expect(screen.getAllByTestId('store-row')).toHaveLength(5);
    expect(screen.getByRole('status')).toHaveTextContent('The app has not been built');
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
  });

  it('leaves the heading to the lesson when embedded', () => {
    render(<CacheLayerExplorer embedded />);
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('marks the step taken, narrates it, and steps back', async () => {
    const user = userEvent.setup();
    render(<CacheLayerExplorer />);
    await user.click(step());
    expect(screen.getByRole('status')).toHaveTextContent('/catalogue prerendered from it');
    expect(screen.getAllByTestId('timeline-step')[0]).toHaveAttribute('aria-current', 'step');
    expect(screen.queryByText(/Before you step/)).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Step back' }));
    expect(screen.getByRole('status')).toHaveTextContent('The app has not been built');
  });

  it('marks the store that answered, and only that one', async () => {
    const user = userEvent.setup();
    render(<CacheLayerExplorer />);
    await stepTimes(user, 2);
    expect(rowFor(/^Prerendered page/)).toHaveAttribute('data-answered', 'true');
    expect(rowFor(/^use cache entry/)).toHaveAttribute('data-answered', 'false');
    expect(screen.getByTestId('answer')).toHaveTextContent('Answered by the prerendered page');
  });

  it('shows the entry ageing and the memo emptied between requests', async () => {
    const user = userEvent.setup();
    render(<CacheLayerExplorer />);
    await user.click(step());
    expect(rowFor(/^Request memo/)).toHaveTextContent('1 of 2 reads went past it');
    await user.click(step());
    expect(rowFor(/^Request memo/)).toHaveTextContent('thrown away with the request');
    expect(rowFor(/^use cache entry/)).toHaveTextContent('catalogue v1');
  });

  it('a shorter lifetime stops the page being prerendered at all', async () => {
    const user = userEvent.setup();
    render(<CacheLayerExplorer />);
    await user.selectOptions(screen.getByLabelText('Lifetime'), 'seconds');
    expect(screen.getByText(/too short to prerender/)).toBeInTheDocument();
    await stepTimes(user, 2);
    expect(rowFor(/^Prerendered page/)).toHaveTextContent('not prerendered');
    expect(rowFor(/^use cache entry/)).toHaveAttribute('data-answered', 'true');
  });

  it('serves the old forecast and refreshes behind it an hour on', async () => {
    const user = userEvent.setup();
    render(<CacheLayerExplorer />);
    await user.selectOptions(screen.getByLabelText('Scenario'), 'old-data-now');
    await stepTimes(user, 5);
    expect(screen.getByTestId('answer')).toHaveTextContent('a refresh ran behind it');
    expect(screen.getByRole('status')).toHaveTextContent('refreshed behind it to v2');
  });

  it('makes the request wait once the entry has expired', async () => {
    const user = userEvent.setup();
    render(<CacheLayerExplorer />);
    await user.selectOptions(screen.getByLabelText('Scenario'), 'old-data-now');
    await user.selectOptions(screen.getByLabelText('Time that passes'), 'past-expire');
    await stepTimes(user, 5);
    expect(screen.getByTestId('answer')).toHaveTextContent('the request waited');
  });

  it('shows Back answered by the visitor’s own tab after a tag update', async () => {
    const user = userEvent.setup();
    render(<CacheLayerExplorer />);
    await user.selectOptions(screen.getByLabelText('Scenario'), 'what-a-tag-update-misses');
    await stepTimes(user, 5);
    expect(rowFor(/Router cache, Visitor A/)).toHaveAttribute('data-answered', 'true');
    expect(screen.getByTestId('answer')).toHaveTextContent('v1');
    await user.click(step());
    expect(screen.getByTestId('answer')).toHaveTextContent('the request waited');
    expect(screen.getByTestId('answer')).toHaveTextContent('v2');
  });

  it('sends Back to the server when the visitor ran the action themselves', async () => {
    const user = userEvent.setup();
    render(<CacheLayerExplorer />);
    await user.selectOptions(screen.getByLabelText('Scenario'), 'what-a-tag-update-misses');
    await user.selectOptions(screen.getByLabelText('The action'), 'update-by-visitor');
    await stepTimes(user, 5);
    expect(screen.getByRole('status')).toHaveTextContent('router cache had gone');
    expect(screen.getByTestId('answer')).toHaveTextContent('v2');
  });

  it('takes the lesson’s own case from a preset and offers it first', async () => {
    const user = userEvent.setup();
    render(<CacheLayerExplorer preset={LESSON_PRESET} />);
    expect(screen.getByLabelText('Scenario')).toHaveValue(LESSON_SCENARIO_ID);
    expect(screen.getByLabelText('Lifetime')).toHaveValue('max');
    expect(screen.getAllByTestId('timeline-step')).toHaveLength(6);
    expect(
      within(screen.getAllByTestId('timeline-step')[3] as HTMLElement).getByText(/updateTag/),
    ).toBeInTheDocument();

    // The lesson's checkpoint: Back shows the old menu, from the visitor's own tab.
    await stepTimes(user, 5);
    expect(rowFor(/Router cache, Visitor A/)).toHaveAttribute('data-answered', 'true');
    expect(screen.getByTestId('answer')).toHaveTextContent('v1');
    // And the next visitor waits for the new menu.
    await user.click(step());
    expect(screen.getByTestId('answer')).toHaveTextContent('the request waited');
    expect(screen.getByTestId('answer')).toHaveTextContent('v2');
  });

  it('shows only the store rows a lesson asked for', () => {
    render(<CacheLayerExplorer preset={{ ...LESSON_PRESET, stores: ['use-cache-entry'] }} />);
    expect(screen.getAllByTestId('store-row')).toHaveLength(1);
  });

  it('lists what the model leaves out', () => {
    render(<CacheLayerExplorer />);
    expect(screen.getByText('What this leaves out')).toBeInTheDocument();
    expect(screen.getByText(/use cache: private/)).toBeInTheDocument();
  });
});

describe('parseCall', () => {
  it('reads the three calls a lesson can write', () => {
    expect(parseCall('refresh()')).toEqual({ fn: 'refresh' });
    expect(parseCall("updateTag('menu')")).toEqual({ fn: 'updateTag', tag: 'menu' });
    expect(parseCall("revalidateTag('menu', 'max')")).toEqual({
      fn: 'revalidateTag',
      tag: 'menu',
      window: 'max',
    });
    expect(parseCall("revalidateTag('menu')")).toEqual({
      fn: 'revalidateTag',
      tag: 'menu',
      window: 'max',
    });
  });

  it('refuses anything else', () => {
    expect(parseCall('revalidatePath("/menu")')).toBeNull();
    expect(parseCall('updateTag(menu)')).toBeNull();
    expect(parseCall('')).toBeNull();
  });
});

describe('parsePreset', () => {
  it('builds the lesson’s case, with the action run by staff when no actor is named', () => {
    const preset = parsePreset(LESSON_PRESET);
    expect(preset.scenario).toBe(LESSON_SCENARIO_ID);
    expect(preset.custom?.actors.map((actor) => actor.label)).toEqual([
      'Visitor A',
      'Staff',
      'Visitor B',
    ]);
    expect(preset.custom?.routes).toEqual([
      { path: '/menu', usesCache: true },
      { path: '/order', usesCache: false },
    ]);
    expect(preset.custom?.cache).toEqual({
      label: 'menu',
      life: 'max',
      tag: 'menu',
      reads: 2,
      memoised: true,
    });
  });

  it('falls back to a shipped case whole when the timeline cannot be read', () => {
    expect(parsePreset({ route: '/menu', timeline: [{ event: 'visit', actor: 'A' }] })).toEqual({
      scenario: 'first-visit',
      variant: 'default',
      custom: null,
      stores: [],
    });
    expect(parsePreset(undefined).scenario).toBe('first-visit');
    expect(parsePreset({ scenario: 'nope' }).scenario).toBe('first-visit');
  });

  it('takes a shipped case and variant by name', () => {
    const preset = parsePreset({ scenario: 'one-render-one-read', variant: 'plain' });
    expect(preset).toMatchObject({
      scenario: 'one-render-one-read',
      variant: 'plain',
      custom: null,
    });
  });

  it('needs a route before it will build a case from a timeline', () => {
    expect(parsePreset({ timeline: [{ event: 'build' }] }).custom).toBeNull();
  });
});
