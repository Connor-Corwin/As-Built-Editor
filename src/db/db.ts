import Dexie, { type Table } from 'dexie';
import type {
  Annotation,
  Connection,
  PdfDocument,
  Point,
  Project,
  Rack,
  RackEquipment,
} from './models';

/**
 * Local-first IndexedDB store. Uploaded drawings and the editable as-built
 * data live entirely in the browser — nothing leaves the machine. A sync
 * backend can be layered on later without changing call sites.
 */
export class AsBuiltDB extends Dexie {
  projects!: Table<Project, string>;
  documents!: Table<PdfDocument, string>;
  racks!: Table<Rack, string>;
  equipment!: Table<RackEquipment, string>;
  connections!: Table<Connection, string>;
  annotations!: Table<Annotation, string>;
  points!: Table<Point, string>;

  constructor() {
    super('as-built-editor');
    // Indexes only need the fields we query on; blobs/objects are stored
    // inline without being indexed.
    this.version(1).stores({
      projects: 'id, name, updatedAt',
      documents: 'id, projectId, addedAt',
      racks: 'id, projectId',
      equipment: 'id, rackId',
      connections: 'id, projectId',
      annotations: 'id, projectId, documentId',
    });
    // v2 adds points (nodes of the editable copy).
    this.version(2).stores({
      points: 'id, projectId, documentId',
    });
  }
}

export const db = new AsBuiltDB();

/** Stable, dependency-free id generator (works in jsdom and browsers). */
export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
