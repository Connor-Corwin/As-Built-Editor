import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { createProject } from './repository';
import { exportProject, importProject } from './projectIO';
import type { PdfDocument } from './models';

async function seedDocument(projectId: string, name: string): Promise<void> {
  const doc: PdfDocument = {
    id: crypto.randomUUID(),
    projectId,
    fileName: name,
    blob: new Blob([new Uint8Array([1, 2, 3, 4, 5])], {
      type: 'application/pdf',
    }),
    size: 5,
    pageCount: 2,
    addedAt: Date.now(),
  };
  await db.documents.add(doc);
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

describe('project export/import', () => {
  it('round-trips a project as a new copy with its documents', async () => {
    const project = await createProject('Site A');
    await seedDocument(project.id, 'rack.pdf');
    await seedDocument(project.id, 'flow.pdf');

    const { blob, fileName } = await exportProject(project.id);
    expect(fileName).toBe('Site A.abe.json');

    const file = new File([blob], fileName, { type: 'application/json' });
    const newId = await importProject(file);

    expect(newId).not.toBe(project.id);
    const imported = await db.projects.get(newId);
    expect(imported?.name).toBe('Site A (imported)');

    const docs = await db.documents.where('projectId').equals(newId).sortBy(
      'fileName',
    );
    expect(docs.map((d) => d.fileName)).toEqual(['flow.pdf', 'rack.pdf']);
    // Blob bytes survived the base64 round-trip.
    const bytes = new Uint8Array(await docs[0].blob.arrayBuffer());
    expect(Array.from(bytes)).toEqual([1, 2, 3, 4, 5]);

    // Original project is untouched.
    const originalDocs = await db.documents
      .where('projectId')
      .equals(project.id)
      .count();
    expect(originalDocs).toBe(2);
  });

  it('rejects a non-project file', async () => {
    const file = new File(['{"hello":1}'], 'x.json', {
      type: 'application/json',
    });
    await expect(importProject(file)).rejects.toThrow(/not an As-Built/i);
  });
});
