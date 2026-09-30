import { DEFAULT_URL } from './journey';
import type { JourneyInput } from './types';

export type ScenarioId = 'first-visit' | 'second-visit' | 'cdn-edge' | 'on-sale' | 'h3-0rtt';

export interface Scenario {
  id: ScenarioId;
  title: string;
  /** One line that sets the scene. */
  story: string;
  /** Asked before the first step. */
  prediction: string;
  input: JourneyInput;
}

const COLD_4G: JourneyInput = {
  url: DEFAULT_URL,
  rttMs: 80,
  dnsCached: false,
  connectionReused: false,
  tlsResumed: false,
  http: '2',
  cdn: 'none',
  edgeRttMs: 15,
  httpCache: 'empty',
  serverMs: 120,
  htmlKb: 60,
  bandwidthMbps: 20,
  renderBlockingCss: true,
};

export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'first-visit',
    title: 'First visit from a phone on 4G',
    story:
      'Someone taps a link to a weather forecast. Every cache is cold and each round trip is 80 ms.',
    prediction: 'Before you step: which hop will cost the most?',
    input: COLD_4G,
  },
  {
    id: 'second-visit',
    title: 'Second visit',
    story:
      'Same person, a few minutes later. DNS is cached, the connection is still open and the HTTP cache holds a stale copy.',
    prediction: 'Before you step: with the handshakes gone, which hop is left to cost the most?',
    input: {
      ...COLD_4G,
      dnsCached: true,
      connectionReused: true,
      httpCache: 'stale',
      serverMs: 30,
    },
  },
  {
    id: 'cdn-edge',
    title: 'Forecast page from the CDN edge',
    story:
      'The forecast is the same for everyone, so an edge 15 ms away may answer for the origin.',
    prediction:
      'Before you step: the edge is close and skips the server. Which hop costs the most now?',
    input: { ...COLD_4G, cdn: 'hit' },
  },
  {
    id: 'on-sale',
    title: 'Storm warning, origin under load',
    story: 'A storm warning went out a minute ago. The origin takes 1800 ms to render the page.',
    prediction: 'Before you step: is the network the slow part now?',
    input: { ...COLD_4G, serverMs: 1800 },
  },
  {
    id: 'h3-0rtt',
    title: 'HTTP/3 with 0-RTT resumption',
    story:
      'A returning visitor on HTTP/3. The browser kept a session ticket, so the request leaves in the first flight.',
    prediction: 'Before you step: no handshake round trips remain. Which hop costs the most?',
    input: { ...COLD_4G, http: '3', dnsCached: true, tlsResumed: true },
  },
];

export const DEFAULT_SCENARIO: Scenario = SCENARIOS[0]!;

export function scenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find((scenario) => scenario.id === id);
}
