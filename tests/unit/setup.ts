// Vitest global setup. fake-indexeddb gives Dexie a real IndexedDB
// implementation in Node so repository tests exercise the actual DB path.
import 'fake-indexeddb/auto';
