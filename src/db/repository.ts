import { db, newId } from './db';
import type { PdfDocument, Project } from './models';
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
