import 'fake-indexeddb/auto';
import { IdbEventStore } from '@/adapters/idb/event-store';
import { MemoryEventStore } from '@/adapters/memory/event-store';
import { eventStoreContract } from './contract';

let n = 0;

eventStoreContract('MemoryEventStore', () => new MemoryEventStore());
// A fresh database name per test keeps them independent without deleting databases.
eventStoreContract('IdbEventStore', () => new IdbEventStore(`test-${n++}`));
