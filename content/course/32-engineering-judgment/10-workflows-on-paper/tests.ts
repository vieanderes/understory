import { checkWorkflow, type Transition } from './solution';

const t = (from: string, to: string, event: string): Transition => ({ from, to, event });

const episode = [
  t('Transcribing', 'Drafting', 'transcript ready'),
  t('Transcribing', 'TranscribeFailed', 'error'),
  t('TranscribeFailed', 'Transcribing', 'retry'),
  t('TranscribeFailed', 'NeedsHelp', 'third failure'),
  t('Drafting', 'AwaitingApproval', 'draft ready'),
  t('AwaitingApproval', 'Published', 'approved'),
  t('AwaitingApproval', 'Drafting', 'changes requested'),
];
const ends = ['Published', 'NeedsHelp'];

test('a workflow whose retries can still finish has no problems', () => {
  expect(checkWorkflow({ initial: 'Transcribing', terminal: ends, transitions: episode })).toEqual([]);
});

test('a failure state with no way out is stuck', () => {
  const transitions = [...episode, t('AwaitingApproval', 'PublishFailed', 'feed error')];
  expect(checkWorkflow({ initial: 'Transcribing', terminal: ends, transitions })).toEqual(['stuck: PublishFailed']);
});

test('a retry that only ever loops back to itself is stuck', () => {
  const transitions = [
    ...episode,
    t('AwaitingApproval', 'PublishFailed', 'feed error'),
    t('PublishFailed', 'PublishFailed', 'retry'),
  ];
  expect(checkWorkflow({ initial: 'Transcribing', terminal: ends, transitions })).toEqual(['stuck: PublishFailed']);
});

test('two states that only lead to each other are both stuck', () => {
  const transitions = [t('Start', 'Ping', 'go'), t('Ping', 'Pong', 'next'), t('Pong', 'Ping', 'next'), t('Start', 'Done', 'skip')];
  expect(checkWorkflow({ initial: 'Start', terminal: ['Done'], transitions })).toEqual(['stuck: Ping', 'stuck: Pong']);
});

test('an end state nothing leads to is unreachable, not stuck', () => {
  expect(checkWorkflow({ initial: 'Transcribing', terminal: [...ends, 'Archived'], transitions: episode })).toEqual([
    'unreachable: Archived',
  ]);
});

test('problems follow first appearance, unreachable before stuck', () => {
  const transitions = [t('Orphan', 'Orphan', 'tick'), ...episode];
  expect(checkWorkflow({ initial: 'Transcribing', terminal: ends, transitions })).toEqual([
    'unreachable: Orphan',
    'stuck: Orphan',
  ]);
});
