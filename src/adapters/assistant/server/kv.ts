import { getBridgeStore } from './bridge-store';
import type { KeyValue } from './bridge-store';

/** The keys beside the sessions: the same backend, so Redis when it is configured. */
export function getKeyValue(): KeyValue {
  return getBridgeStore().backend;
}
