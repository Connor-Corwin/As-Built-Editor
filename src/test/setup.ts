import '@testing-library/jest-dom/vitest';
// In-memory IndexedDB so Dexie works under jsdom/Vitest.
import 'fake-indexeddb/auto';
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';

// jsdom's Blob/File don't implement arrayBuffer()/text() and aren't compatible
// with Node's structuredClone (which fake-indexeddb uses to persist values).
// Swap in Node's implementations so blob round-trips through IndexedDB work in
// tests, matching real browser behaviour. Test-only — app code is untouched.
globalThis.Blob = NodeBlob as unknown as typeof globalThis.Blob;
globalThis.File = NodeFile as unknown as typeof globalThis.File;
