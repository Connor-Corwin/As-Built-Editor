import { beforeEach, describe, expect, it } from 'vitest';
import { db, newId } from './db';
import {
  createProject,
  deleteProject,
  getProject,
  listDocuments,
  listProjects,
  renameProject,
} from './repository';
import type { PdfDocument } from './models';

/** Insert a document directly, bypassing PDF.js parsing (covered elsewhere). */
async function seedDocument(projectId: string): Promise<PdfDocument> {
  const doc: PdfDocument = {
    id: newId(),
    projectId,
    fileName: 'rack-elevation.pdf',
    blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'application/pdf' }),
    size: 3,
    pageCount: 1,
    addedAt: Date.now(),
  };
  await db.documents.add(doc);
  return doc;
}

beforeEach(async () => {
  await Promise.all([
    db.projects.clear(),
    db.documents.clear(),
    db.racks.clear(),
    db.equipment.clear(),
    db.connections.clear(),
    db.annotations.clear(),
  ]);
});

describe('newId', () => {
  it('produces unique, non-empty ids', () => {
    const ids = new Set(Array.from({ length: 100 }, () => newId()));
    expect(ids.size).toBe(100);
    for (const id of ids) expect(id.length).toBeGreaterThan(0);
  });
});

describe('project CRUD', () => {
  it('creates a project with timestamps and a trimmed name', async () => {
    const p = await createProject('  Building A  ');
    expect(p.name).toBe('Building A');
    expect(p.createdAt).toBeGreaterThan(0);
    expect(await getProject(p.id)).toMatchObject({ name: 'Building A' });
  });

  it('falls back to a default name when blank', async () => {
    const p = await createProject('   ');
    expect(p.name).toBe('Untitled project');
  });

  it('renames a project and bumps updatedAt', async () => {
    const p = await createProject('Old');
    await renameProject(p.id, 'New Name');
    const updated = await getProject(p.id);
    expect(updated?.name).toBe('New Name');
    expect(updated!.updatedAt).toBeGreaterThanOrEqual(p.updatedAt);
  });

  it('lists projects most-recently-updated first', async () => {
    // Force strictly increasing timestamps so ordering is deterministic
    // (real Date.now() can collide within a millisecond on fast machines).
    let t = 1000;
    const spy = vi.spyOn(Date, 'now').mockImplementation(() => t++);
    try {
      const a = await createProject('A');
      const b = await createProject('B');
      // Make A the most recently updated.
      await renameProject(a.id, 'A2');
      const list = await listProjects();
      expect(list.map((p) => p.id)).toEqual([a.id, b.id]);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('cascade delete', () => {
  it('removes a project and all of its documents', async () => {
    const project = await createProject('With docs');
    await seedDocument(project.id);
    await seedDocument(project.id);
    expect(await listDocuments(project.id)).toHaveLength(2);

    await deleteProject(project.id);

    expect(await getProject(project.id)).toBeUndefined();
    expect(await listDocuments(project.id)).toHaveLength(0);
  });

  it('leaves other projects untouched', async () => {
    const keep = await createProject('Keep');
    const drop = await createProject('Drop');
    await seedDocument(keep.id);
    await seedDocument(drop.id);

    await deleteProject(drop.id);

    expect(await getProject(keep.id)).toBeDefined();
    expect(await listDocuments(keep.id)).toHaveLength(1);
  });
});
