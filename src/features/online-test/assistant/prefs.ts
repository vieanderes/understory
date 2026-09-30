'use client';

import { useSyncExternalStore } from 'react';
import type { AssistantProviderId } from '@/core/ports/assistant';
import {
  ASSISTANT_MODELS,
  createPairingCode,
  createTabSecret,
  DEFAULT_ASSISTANT_MODEL,
  endMcpSession,
  fetchMcpStatus,
  localCliAvailable,
  NO_MCP_STATUS,
  type AssistantModel,
  type McpStatus,
  type Pairing,
} from '@/adapters/assistant';

/*
 * The assistant's preferences as external stores read with useSyncExternalStore, so the
 * panel never mirrors storage into state in an effect (AGENTS.md, law 8). Storage can be
 * missing or throw (private windows, blocked site data); every access is guarded and the
 * panel works from memory when it does.
 */

export const KEY_STORAGE = 'understory:assistant:key';
export const PROVIDER_STORAGE = 'understory:assistant:provider';
export const MODEL_STORAGE = 'understory:assistant:model';
export const PAIRING_STORAGE = 'understory:assistant:pairing';

type Area = 'local' | 'session';

function storage(area: Area): Storage | undefined {
  try {
    return area === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return undefined;
  }
}

interface StringStore {
  get(): string;
  set(value: string): void;
  subscribe(notify: () => void): () => void;
}

function createStringStore(key: string, area: Area): StringStore {
  const listeners = new Set<() => void>();
  // What was last written, only while storage refuses it.
  let memory: string | undefined;

  const get = () => {
    try {
      const store = storage(area);
      if (store) return store.getItem(key) ?? '';
    } catch {
      // Blocked storage: fall through to memory.
    }
    return memory ?? '';
  };

  return {
    get,
    set(value) {
      try {
        const store = storage(area);
        if (!store) throw new Error('No storage');
        if (value) store.setItem(key, value);
        else store.removeItem(key);
        memory = undefined;
      } catch {
        // Quota or blocked: memory keeps it for this visit.
        memory = value;
      }
      listeners.forEach((notify) => notify());
    },
    subscribe(notify) {
      listeners.add(notify);
      const onStorage = (event: StorageEvent) => {
        if (event.key === key) notify();
      };
      window.addEventListener('storage', onStorage);
      return () => {
        listeners.delete(notify);
        window.removeEventListener('storage', onStorage);
      };
    },
  };
}

export const keyStore = createStringStore(KEY_STORAGE, 'local');
export const providerStore = createStringStore(PROVIDER_STORAGE, 'local');
export const modelStore = createStringStore(MODEL_STORAGE, 'local');
// Per tab: two tabs of the simulator are two candidates as far as the app is concerned.
const pairingStore = createStringStore(PAIRING_STORAGE, 'session');

const noServer = () => '';

export function useApiKey(): string {
  return useSyncExternalStore(keyStore.subscribe, keyStore.get, noServer);
}

const PROVIDERS: readonly AssistantProviderId[] = ['api-key', 'claude-cli', 'mcp'];

/** A Claude account needs no key, so MCP comes first; a key is for those who have one. */
export const DEFAULT_PROVIDER: AssistantProviderId = 'mcp';

export function readProvider(): AssistantProviderId {
  const stored = providerStore.get();
  return (PROVIDERS as readonly string[]).includes(stored)
    ? (stored as AssistantProviderId)
    : DEFAULT_PROVIDER;
}

export function useProvider(): AssistantProviderId {
  return useSyncExternalStore(providerStore.subscribe, readProvider, () => DEFAULT_PROVIDER);
}

export function readModel(): AssistantModel {
  const stored = modelStore.get();
  return (ASSISTANT_MODELS as readonly string[]).includes(stored)
    ? (stored as AssistantModel)
    : DEFAULT_ASSISTANT_MODEL;
}

export function useModel(): AssistantModel {
  return useSyncExternalStore(modelStore.subscribe, readModel, () => DEFAULT_ASSISTANT_MODEL);
}

/*
 * This tab's pairing: the code it shows and the secret it keeps, stored together as
 * "CODE:secret". Made on first read and kept for the tab's life, or until the learner
 * asks for a new code.
 */
let pairingCache: { raw: string; pairing: Pairing } | undefined;

function makePairing(): string {
  return `${createPairingCode()}:${createTabSecret()}`;
}

export function readPairing(): Pairing {
  let raw = pairingStore.get();
  // A tab from before the secret existed holds a bare code: it gets a fresh pair.
  if (!/^[A-Z0-9]{8}:[0-9a-f]{64}$/.test(raw)) {
    raw = makePairing();
    pairingStore.set(raw);
  }
  // The same object for the same value, as useSyncExternalStore needs.
  if (pairingCache?.raw !== raw) {
    const [code = '', secret = ''] = raw.split(':');
    pairingCache = { raw, pairing: { code, secret } };
  }
  return pairingCache.pairing;
}

const NO_PAIRING: Pairing = { code: '', secret: '' };

export function usePairing(): Pairing {
  return useSyncExternalStore(pairingStore.subscribe, readPairing, () => NO_PAIRING);
}

/** A new code and secret. The old session ends at once, so the old code stops working. */
export function rotatePairing(): void {
  const old = readPairing();
  void endMcpSession(old);
  pairingStore.set(makePairing());
}

/*
 * The app's connection as the panel shows it: polled every two seconds while a panel that
 * uses MCP is on screen and the page is visible, so an Allow request shows up without the
 * learner asking first.
 */
const STATUS_POLL_MS = 2000;
let status: McpStatus = NO_MCP_STATUS;
let statusKey = '';
const statusListeners = new Set<() => void>();
let statusTimer: ReturnType<typeof setTimeout> | undefined;

async function pollStatus() {
  statusTimer = undefined;
  if (statusListeners.size === 0) return;
  if (document.visibilityState === 'visible') {
    const pairing = readPairing();
    const key = `${pairing.code}:${pairing.secret}`;
    const next = await fetchMcpStatus(pairing);
    if (next && readPairing() === pairing) {
      // A code another tab took is no use here: this tab moves to a fresh one.
      if (next.taken) rotatePairing();
      status = next.taken ? NO_MCP_STATUS : next;
      statusKey = key;
      statusListeners.forEach((notify) => notify());
    }
  }
  if (statusListeners.size > 0) statusTimer ??= setTimeout(pollStatus, STATUS_POLL_MS);
}

/** Polls at once, for after an Allow or Deny. */
export function refreshMcpStatus(): void {
  clearTimeout(statusTimer);
  void pollStatus();
}

function subscribeStatus(notify: () => void) {
  statusListeners.add(notify);
  if (statusListeners.size === 1) refreshMcpStatus();
  return () => {
    statusListeners.delete(notify);
    if (statusListeners.size === 0) {
      clearTimeout(statusTimer);
      statusTimer = undefined;
    }
  };
}

function readStatus(): McpStatus {
  // After a new code the old code's status no longer applies.
  const pairing = readPairing();
  return statusKey === `${pairing.code}:${pairing.secret}` ? status : NO_MCP_STATUS;
}

const noSubscription = () => () => {};

export function useMcpStatus(enabled: boolean): McpStatus {
  return useSyncExternalStore(
    enabled ? subscribeStatus : noSubscription,
    enabled ? readStatus : () => NO_MCP_STATUS,
    () => NO_MCP_STATUS,
  );
}

/*
 * Whether the local Claude account provider can be offered. Asked once per page load,
 * when the first panel subscribes; the answer does not change while the server runs.
 */
type Availability = 'unknown' | 'available' | 'unavailable';
let availability: Availability = 'unknown';
let asking: Promise<void> | undefined;
const availabilityListeners = new Set<() => void>();

function subscribeAvailability(notify: () => void) {
  availabilityListeners.add(notify);
  asking ??= localCliAvailable().then((ok) => {
    availability = ok ? 'available' : 'unavailable';
    availabilityListeners.forEach((listener) => listener());
  });
  return () => {
    availabilityListeners.delete(notify);
  };
}

export function useLocalCliAvailability(): Availability {
  return useSyncExternalStore(
    subscribeAvailability,
    () => availability,
    () => 'unknown',
  );
}

/** For tests: forget the cached answer. */
export function resetLocalCliAvailability() {
  availability = 'unknown';
  asking = undefined;
}

function subscribeNothing() {
  return () => {};
}

/** The origin the MCP command names. */
export function useOrigin(): string {
  return useSyncExternalStore(
    subscribeNothing,
    () => window.location.origin,
    () => 'http://localhost:3000',
  );
}
