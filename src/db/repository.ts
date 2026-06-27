import { db, newId } from './db';
import type {
  Connection,
  PdfDocument,
  Project,
  Rack,
  RackEquipment,
} from './models';
import { getPdfPageCount } from '../lib/pdf';

/**
 * CRUD helpers over the Dexie store. UI components call these instead of
 * touching Dexie directly, so the storage layer stays swappable.
 */

// ---- Projects -------------------------------------------------------------

export async function createProject(
  name: string,
  description?: string,
): Promise<Project> {
  const now = Date.now();
  const project: Project = {
    id: newId(),
    name: name.trim() || 'Untitled project',
    description: description?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
  await db.projects.add(project);
  return project;
}

export async function renameProject(id: string, name: string): Promise<void> {
  await db.projects.update(id, {
    name: name.trim() || 'Untitled project',
    updatedAt: Date.now(),
  });
}

export async function touchProject(id: string): Promise<void> {
  await db.projects.update(id, { updatedAt: Date.now() });
}

/** Delete a project and everything that belongs to it. */
export async function deleteProject(id: string): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.projects,
      db.documents,
      db.racks,
      db.equipment,
      db.connections,
      db.annotations,
    ],
    async () => {
      await db.documents.where('projectId').equals(id).delete();
      await db.racks.where('projectId').equals(id).delete();
      await db.connections.where('projectId').equals(id).delete();
      await db.annotations.where('projectId').equals(id).delete();
      await db.projects.delete(id);
    },
  );
}

export function listProjects(): Promise<Project[]> {
  // Most recently updated first.
  return db.projects.orderBy('updatedAt').reverse().toArray();
}

export function getProject(id: string): Promise<Project | undefined> {
  return db.projects.get(id);
}

// ---- Documents ------------------------------------------------------------

/**
 * Add an uploaded PDF to a project. Reads the page count via PDF.js up front
 * so the UI can show it without re-parsing.
 */
export async function addPdfDocument(
  projectId: string,
  file: File,
): Promise<PdfDocument> {
  const buffer = await file.arrayBuffer();
  const pageCount = await getPdfPageCount(buffer.slice(0));
  const doc: PdfDocument = {
    id: newId(),
    projectId,
    fileName: file.name,
    blob: new Blob([buffer], { type: 'application/pdf' }),
    size: file.size,
    pageCount,
    addedAt: Date.now(),
  };
  await db.documents.add(doc);
  await touchProject(projectId);
  return doc;
}

export function listDocuments(projectId: string): Promise<PdfDocument[]> {
  return db.documents
    .where('projectId')
    .equals(projectId)
    .sortBy('addedAt');
}

export function getDocument(id: string): Promise<PdfDocument | undefined> {
  return db.documents.get(id);
}

export async function deleteDocument(id: string): Promise<void> {
  const doc = await db.documents.get(id);
  await db.documents.delete(id);
  if (doc) await touchProject(doc.projectId);
}

// ---- Racks ----------------------------------------------------------------

export async function createRack(
  projectId: string,
  name: string,
  ruHeight = 42,
): Promise<Rack> {
  const rack: Rack = {
    id: newId(),
    projectId,
    name: name.trim() || 'New rack',
    ruHeight: Math.min(60, Math.max(1, Math.round(ruHeight))),
  };
  await db.racks.add(rack);
  await touchProject(projectId);
  return rack;
}

export function listRacks(projectId: string): Promise<Rack[]> {
  return db.racks.where('projectId').equals(projectId).sortBy('name');
}

export function getRack(id: string): Promise<Rack | undefined> {
  return db.racks.get(id);
}

export async function updateRack(
  id: string,
  changes: Partial<Pick<Rack, 'name' | 'ruHeight'>>,
): Promise<void> {
  await db.racks.update(id, changes);
  const rack = await db.racks.get(id);
  if (rack) await touchProject(rack.projectId);
}

/** Delete a rack and its equipment. */
export async function deleteRack(id: string): Promise<void> {
  const rack = await db.racks.get(id);
  await db.transaction('rw', [db.racks, db.equipment], async () => {
    await db.equipment.where('rackId').equals(id).delete();
    await db.racks.delete(id);
  });
  if (rack) await touchProject(rack.projectId);
}

// ---- Rack equipment -------------------------------------------------------

export function listEquipment(rackId: string): Promise<RackEquipment[]> {
  return db.equipment.where('rackId').equals(rackId).sortBy('startU');
}

export async function addEquipment(
  rackId: string,
  item: Omit<RackEquipment, 'id' | 'rackId'>,
): Promise<RackEquipment> {
  const equipment: RackEquipment = { id: newId(), rackId, ...item };
  await db.equipment.add(equipment);
  return equipment;
}

export async function updateEquipment(
  id: string,
  changes: Partial<Omit<RackEquipment, 'id' | 'rackId'>>,
): Promise<void> {
  await db.equipment.update(id, changes);
}

export async function deleteEquipment(id: string): Promise<void> {
  await db.equipment.delete(id);
}

/** All equipment across a project's racks, with the owning rack's name. */
export async function listProjectDevices(
  projectId: string,
): Promise<Array<{ id: string; label: string; rackName: string }>> {
  const racks = await listRacks(projectId);
  const byId = new Map(racks.map((r) => [r.id, r.name]));
  const rackIds = racks.map((r) => r.id);
  if (rackIds.length === 0) return [];
  const equipment = await db.equipment
    .where('rackId')
    .anyOf(rackIds)
    .toArray();
  return equipment.map((e) => ({
    id: e.id,
    label: e.label,
    rackName: byId.get(e.rackId) ?? '',
  }));
}

// ---- Connections ----------------------------------------------------------

export async function createConnection(
  projectId: string,
  data: Omit<Connection, 'id' | 'projectId'>,
): Promise<Connection> {
  const connection: Connection = { id: newId(), projectId, ...data };
  await db.connections.add(connection);
  await touchProject(projectId);
  return connection;
}

export function listConnections(projectId: string): Promise<Connection[]> {
  return db.connections.where('projectId').equals(projectId).toArray();
}

export async function updateConnection(
  id: string,
  changes: Partial<Omit<Connection, 'id' | 'projectId'>>,
): Promise<void> {
  await db.connections.update(id, changes);
}

export async function deleteConnection(id: string): Promise<void> {
  await db.connections.delete(id);
}
