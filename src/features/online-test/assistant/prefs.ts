'use client';

import { useSyncExternalStore } from 'react';
import type { AssistantProviderId } from '@/core/ports/assistant';
import {
  ASSISTANT_MODELS,
  createPairingCode,
  DEFAULT_ASSISTANT_MODEL,
  localCliAvailable,
  type AssistantModel,
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

/** This tab's pairing code, made on first read and kept for the tab's life. */
export function readPairingCode(): string {
  let code = pairingStore.get();
  if (!code) {
    code = createPairingCode();
    pairingStore.set(code);
  }
  return code;
}

export function usePairingCode(): string {
  return useSyncExternalStore(pairingStore.subscribe, readPairingCode, noServer);
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
