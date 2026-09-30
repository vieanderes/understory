import { describe, expect, it } from 'vitest';
import { DEFAULT_SCENARIO, SCENARIOS, journey, scenarioById } from '@/core/labs/request-journey';

const dominantOf = (id: string) => journey(scenarioById(id)!.input).dominant;

describe('scenarios', () => {
  it('ships five, each with a prediction prompt', () => {
    expect(SCENARIOS).toHaveLength(5);
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(5);
    expect(SCENARIOS.every((s) => s.prediction.startsWith('Before you step'))).toBe(true);
    expect(DEFAULT_SCENARIO.id).toBe('first-visit');
    expect(scenarioById('nope')).toBeUndefined();
  });

  it('first visit on 4G: latency-bound hops dominate, DNS most of all', () => {
    expect(dominantOf('first-visit')).toEqual(['dns']);
    expect(journey(scenarioById('first-visit')!.input).totalMs).toBe(691);
  });

  it('second visit: one round trip with a 304 is what remains', () => {
    const run = journey(scenarioById('second-visit')!.input);
    expect(run.dominant).toEqual(['request']);
    expect(run.totalMs).toBe(80 + 30 + 30 + 45);
    expect(run.frames.flatMap((f) => [...f.lines])).toContain(':status: 304');
  });

  it('CDN edge: every round trip is 15 ms and the origin is never asked', () => {
    const run = journey(scenarioById('cdn-edge')!.input);
    expect(run.breakdown.find((entry) => entry.hop === 'server')!.ms).toBe(0);
    expect(run.breakdown.find((entry) => entry.hop === 'request')!.ms).toBe(15);
    expect(run.dominant).toEqual(['dns']);
  });

  it('storm warning: server time dominates, not the network', () => {
    const run = journey(scenarioById('on-sale')!.input);
    expect(run.dominant).toEqual(['server']);
    expect(1800 / run.totalMs).toBeGreaterThan(0.7);
  });

  it('HTTP/3 with 0-RTT: no handshake round trips, the server is what is left', () => {
    const run = journey(scenarioById('h3-0rtt')!.input);
    expect(run.breakdown.find((entry) => entry.hop === 'quic')!.ms).toBe(0);
    expect(run.dominant).toEqual(['server']);
  });
});
