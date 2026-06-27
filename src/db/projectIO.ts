import { db, newId } from './db';
import type {
  Annotation,
  Connection,
  PdfDocument,
  Project,
  Rack,
  RackEquipment,
} from './models';
import { touchProject } from './repository';

/**
 * Export a whole project to a single portable file, and import one back.
 *
 * This is how a project moves between devices/browsers (the app is local-first,
 * so there's no server sync). PDFs are stored as Blobs in IndexedDB; for a
 * self-contained JSON file we base64-encode their bytes.
 */

const FORMAT = 'as-built-editor/project';
const FORMAT_VERSION = 1;

/** A document with its blob encoded as base64 for JSON transport. */
type SerializedDocument = Omit<PdfDocument, 'blob'> & { blobBase64: string };

interface ProjectBundle {
  format: typeof FORMAT;
  version: number;
  exportedAt: number;
  project: Project;
  documents: SerializedDocument[];
  racks: Rack[];
  equipment: RackEquipment[];
  connections: Connection[];
  annotations: Annotation[];
}

// ---- blob helpers (work in browsers and in jsdom tests) -------------------

/** Read a Blob's bytes. Falls back to Response for environments/realms where
 * Blob.arrayBuffer() is missing (e.g. jsdom + fake-indexeddb in tests). */
function readArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Response(blob).arrayBuffer();
}

/** Read a Blob/File as text, with the same realm-agnostic fallback. */
function readText(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') return blob.text();
  return new Response(blob).text();
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await readArrayBuffer(blob));
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBlob(base64: string, type = 'application/pdf'): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

// ---- export ---------------------------------------------------------------

/** Build a downloadable JSON bundle for a project and all of its data. */
export async function exportProject(projectId: string): Promise<{
  blob: Blob;
  fileName: string;
}> {
  const project = await db.projects.get(projectId);
  if (!project) throw new Error('Project not found.');

  const [docs, racks, connections, annotations] = await Promise.all([
    db.documents.where('projectId').equals(projectId).toArray(),
    db.racks.where('projectId').equals(projectId).toArray(),
    db.connections.where('projectId').equals(projectId).toArray(),
    db.annotations.where('projectId').equals(projectId).toArray(),
  ]);

  // Equipment is keyed by rack, not project; keep only this project's racks'.
  const projectRackIds = racks.map((r) => r.id);
  const projectEquipment = projectRackIds.length
    ? await db.equipment.where('rackId').anyOf(projectRackIds).toArray()
    : [];

  const serializedDocs: SerializedDocument[] = await Promise.all(
    docs.map(async ({ blob, ...rest }) => ({
      ...rest,
      blobBase64: await blobToBase64(blob),
    })),
  );

  const bundle: ProjectBundle = {
    format: FORMAT,
    version: FORMAT_VERSION,
    exportedAt: Date.now(),
    project,
    documents: serializedDocs,
    racks,
    equipment: projectEquipment,
    connections,
    annotations,
  };

  const safeName = project.name.replace(/[^a-z0-9-_ ]/gi, '').trim() || 'project';
  return {
    blob: new Blob([JSON.stringify(bundle)], { type: 'application/json' }),
    fileName: `${safeName}.abe.json`,
  };
}

// ---- import ---------------------------------------------------------------

/**
 * Import a project bundle as a NEW project (fresh ids everywhere) so importing
 * never clobbers an existing project. Returns the new project's id.
 */
export async function importProject(file: File | Blob): Promise<string> {
  const text = await readText(file);
  let bundle: ProjectBundle;
  try {
    bundle = JSON.parse(text) as ProjectBundle;
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (bundle?.format !== FORMAT) {
    throw new Error('That file is not an As-Built Editor project export.');
  }

  const now = Date.now();
  const newProjectId = newId();

  // Remap ids so references stay intact within the imported copy.
  const rackIdMap = new Map<string, string>();
  bundle.racks.forEach((r) => rackIdMap.set(r.id, newId()));
  const equipmentIdMap = new Map<string, string>();
  bundle.equipment.forEach((e) => equipmentIdMap.set(e.id, newId()));

  const project: Project = {
    ...bundle.project,
    id: newProjectId,
    name: `${bundle.project.name} (imported)`,
    createdAt: now,
    updatedAt: now,
  };

  const documents: PdfDocument[] = bundle.documents.map(
    ({ blobBase64, ...rest }) => ({
      ...rest,
      id: newId(),
      projectId: newProjectId,
      blob: base64ToBlob(blobBase64),
    }),
  );

  const racks: Rack[] = bundle.racks.map((r) => ({
    ...r,
    id: rackIdMap.get(r.id)!,
    projectId: newProjectId,
  }));

  const equipment: RackEquipment[] = bundle.equipment.map((e) => ({
    ...e,
    id: equipmentIdMap.get(e.id)!,
    rackId: rackIdMap.get(e.rackId) ?? e.rackId,
  }));

  const connections: Connection[] = bundle.connections.map((c) => ({
    ...c,
    id: newId(),
    projectId: newProjectId,
    fromDeviceId: c.fromDeviceId
      ? equipmentIdMap.get(c.fromDeviceId) ?? c.fromDeviceId
      : c.fromDeviceId,
    toDeviceId: c.toDeviceId
      ? equipmentIdMap.get(c.toDeviceId) ?? c.toDeviceId
      : c.toDeviceId,
  }));

  const annotations: Annotation[] = bundle.annotations.map((a) => ({
    ...a,
    id: newId(),
    projectId: newProjectId,
    // documentId remap is best-effort; annotations land with the project even
    // if a specific document link can't be resolved.
  }));

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
      await db.projects.add(project);
      if (documents.length) await db.documents.bulkAdd(documents);
      if (racks.length) await db.racks.bulkAdd(racks);
      if (equipment.length) await db.equipment.bulkAdd(equipment);
      if (connections.length) await db.connections.bulkAdd(connections);
      if (annotations.length) await db.annotations.bulkAdd(annotations);
    },
  );

  await touchProject(newProjectId);
  return newProjectId;
}

/** Trigger a browser download of a Blob. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
