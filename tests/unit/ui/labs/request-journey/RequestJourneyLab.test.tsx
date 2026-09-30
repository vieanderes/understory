import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { journey, scenarioById } from '@/core/labs/request-journey';
import RequestJourneyLab from '@/features/labs/request-journey';
import { startFrom } from '@/features/labs/request-journey/preset';

const stepButton = () => screen.getByRole('button', { name: 'Step' });
const frameCount = (id: string) => journey(scenarioById(id)!.input).frames.length;

async function stepToEnd(user: ReturnType<typeof userEvent.setup>) {
  while (!stepButton().hasAttribute('disabled')) await user.click(stepButton());
}

describe('RequestJourneyLab', () => {
  it('renders the title, the question, the prediction prompt and an empty log', () => {
    render(<RequestJourneyLab />);
    expect(screen.getByRole('heading', { level: 1, name: 'Request journey' })).toBeInTheDocument();
    expect(screen.getByText(/where does the time go/)).toBeInTheDocument();
    expect(
      screen.getByLabelText('Before you step: which hop will cost the most?'),
    ).toBeInTheDocument();
    expect(screen.getByText('No messages yet.')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      /Enter pressed on https:\/\/www\.weather\.example/,
    );
    expect(screen.getByText(`Step 1 of ${frameCount('first-visit')}`)).toBeInTheDocument();
  });

  it('leaves the heading to the lesson when embedded', () => {
    render(<RequestJourneyLab embedded />);
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('steps forward and back, says what happened and logs each message', async () => {
    const user = userEvent.setup();
    render(<RequestJourneyLab />);
    await user.click(stepButton());
    expect(screen.getByRole('status')).toHaveTextContent(/split the URL/);
    expect(screen.getByLabelText('Lines on the wire')).toHaveTextContent(
      'host www.weather.example',
    );
    const log = screen.getByRole('region', { name: 'Message log' });
    expect(within(log).getByText('Parse URL')).toBeInTheDocument();
    expect(within(log).getByText('Browser:')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Step back' }));
    expect(screen.getByText('No messages yet.')).toBeInTheDocument();
  });

  it('accumulates milliseconds per hop and names the dominant hop at the end', async () => {
    const user = userEvent.setup();
    render(<RequestJourneyLab />);
    const table = screen.getByRole('table', { name: 'Milliseconds per hop' });
    const dnsRow = within(table).getByRole('row', { name: /DNS lookup/ });
    expect(within(dnsRow).queryByText('140')).toBeNull();

    await stepToEnd(user);
    expect(within(dnsRow).getByText('140')).toBeInTheDocument();
    expect(within(dnsRow).getByText('most')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Timeline' })).toHaveTextContent('691 ms');
    expect(screen.getByTestId('verdict')).toHaveTextContent(
      'DNS lookup cost the most: 140 ms of 691 ms.',
    );
  });

  it('checks the prediction against the run', async () => {
    const user = userEvent.setup();
    render(<RequestJourneyLab />);
    await user.selectOptions(screen.getByLabelText(/Before you step/), 'Server time');
    await stepToEnd(user);
    expect(screen.getByTestId('verdict')).toHaveTextContent('Prediction missed.');
    await user.selectOptions(screen.getByLabelText(/Before you step/), 'DNS lookup');
    expect(screen.getByTestId('verdict')).toHaveTextContent('Prediction holds.');
  });

  it('changes the scenario by keyboard and starts again', async () => {
    const user = userEvent.setup();
    render(<RequestJourneyLab />);
    await user.click(stepButton());
    const select = screen.getByLabelText('Scenario');
    select.focus();
    await user.keyboard('{ArrowDown}');
    // jsdom does not move a select on arrow keys, so the keyboard path is completed by value.
    await user.selectOptions(select, 'Storm warning, origin under load');
    expect(screen.getByText(/The origin takes 1800 ms/)).toBeInTheDocument();
    expect(screen.getByText(`Step 1 of ${frameCount('on-sale')}`)).toBeInTheDocument();
    expect(
      screen.getByLabelText('Before you step: is the network the slow part now?'),
    ).toBeInTheDocument();
  });

  it('operates the transport and the stepper from the keyboard', async () => {
    const user = userEvent.setup();
    render(<RequestJourneyLab />);
    stepButton().focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(screen.getByText(`Step 3 of ${frameCount('first-visit')}`)).toBeInTheDocument();

    screen.getByRole('button', { name: 'Increase round trip time' }).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('group', { name: 'Round trip to the origin' })).toHaveTextContent(
      '90 ms',
    );
  });

  it('updates the whole bar when a cache is toggled after a full run', async () => {
    const user = userEvent.setup();
    render(<RequestJourneyLab />);
    await stepToEnd(user);
    await user.click(screen.getByText('Caches and protocol'));
    await user.click(screen.getByRole('checkbox', { name: 'DNS cached' }));

    const timeline = screen.getByRole('region', { name: 'Timeline' });
    expect(timeline).toHaveTextContent('of 551 ms');
    expect(timeline).toHaveTextContent('was 691 ms');
    const dnsRow = within(timeline).getByRole('row', { name: /DNS lookup/ });
    expect(dnsRow).toHaveTextContent('DNS cached');

    await user.click(screen.getByRole('radio', { name: 'Hit' }));
    expect(within(timeline).getByRole('row', { name: /Server time/ })).toHaveTextContent('CDN hit');
    expect(
      within(screen.getByRole('region', { name: 'Message log' })).getByText('CDN'),
    ).toBeInTheDocument();
  });

  it('clamps the round trip stepper', async () => {
    const user = userEvent.setup();
    render(<RequestJourneyLab preset={{ rttMs: 10 }} />);
    expect(screen.getByRole('button', { name: 'Decrease round trip time' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Increase round trip time' }));
    expect(screen.getByRole('button', { name: 'Decrease round trip time' })).toBeEnabled();
  });

  it('lists what the model leaves out', () => {
    render(<RequestJourneyLab />);
    expect(screen.getByText('What this leaves out')).toBeInTheDocument();
    expect(screen.getByText(/TCP slow start and congestion control/)).toBeInTheDocument();
    expect(screen.getByText(/Happy Eyeballs/)).toBeInTheDocument();
  });
});

describe('preset', () => {
  it('selects a scenario from a lesson', () => {
    render(<RequestJourneyLab preset={{ scenario: 'h3-0rtt' }} />);
    expect(screen.getByLabelText('Scenario')).toHaveValue('h3-0rtt');
    expect(screen.getByText(/kept a session ticket/)).toBeInTheDocument();
  });

  it('applies overrides on top of the scenario', () => {
    const start = startFrom({ scenario: 'cdn-edge', rttMs: 120, http: '3' });
    expect(start.scenario.id).toBe('cdn-edge');
    expect(start.input).toMatchObject({ cdn: 'hit', rttMs: 120, http: '3', edgeRttMs: 15 });
  });

  it('falls back to the default scenario when the preset is invalid', () => {
    expect(startFrom({ scenario: 'nope' }).scenario.id).toBe('first-visit');
    expect(startFrom({ rttMs: 'fast' }).input.rttMs).toBe(80);
    expect(startFrom({ scenario: 'on-sale', rttMs: 99999 }).scenario.id).toBe('first-visit');
    expect(startFrom(undefined).scenario.id).toBe('first-visit');
    render(<RequestJourneyLab preset={{ scenario: 42 }} />);
    expect(screen.getByLabelText('Scenario')).toHaveValue('first-visit');
  });
});
