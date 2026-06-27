/**
 * Domain model for the As-Built Editor.
 *
 * MVP only reads/writes `Project` and `PdfDocument`. The remaining interfaces
 * (Rack / RackEquipment / Connection / Annotation) are defined now so the
 * persistence layer is forward-compatible with the hybrid editor that comes
 * next — they describe the editable digital recreation pinned to the drawing.
 */

export type Id = string;

/** One building / as-built set. */
export interface Project {
  id: Id;
  name: string;
  /** Optional free-form notes (site address, system type, etc.). */
  description?: string;
  createdAt: number;
  updatedAt: number;
}

/** An uploaded source PDF stored as a Blob in IndexedDB. */
export interface PdfDocument {
  id: Id;
  projectId: Id;
  fileName: string;
  /** Raw PDF bytes. Stored as a Blob (not base64) to handle large drawings. */
  blob: Blob;
  /** Byte size, cached for display. */
  size: number;
  pageCount: number;
  addedAt: number;
}

// ---------------------------------------------------------------------------
// Scaffolded entities (no UI in MVP) — the editable digital as-built.
// ---------------------------------------------------------------------------

/** An equipment rack (e.g. 42U AV rack). */
export interface Rack {
  id: Id;
  projectId: Id;
  name: string;
  /** Rack height in rack units (RU). Standard full rack is 42. */
  ruHeight: number;
}

/** A device occupying contiguous rack units within a rack. */
export interface RackEquipment {
  id: Id;
  rackId: Id;
  label: string;
  manufacturer?: string;
  model?: string;
  /** Lowest RU occupied (1-based, counting from bottom). */
  startU: number;
  /** Number of RU the device occupies. */
  heightU: number;
}

export type SignalType =
  | 'audio'
  | 'video'
  | 'network'
  | 'control'
  | 'power'
  | 'other';

/**
 * A cable/signal connection between two endpoints. An endpoint is either a rack
 * device (`fromDeviceId`/`toDeviceId` → RackEquipment) or free text
 * (`fromLabel`/`toLabel`) for things not in a rack (displays, speakers, plates).
 *
 * Optionally drawn on a drawing: when `documentId`/`page` and the `x1..y2`
 * coordinates (normalized 0..1, so they survive zoom) are set, the connection
 * renders as a line on that page.
 */
export interface Connection {
  id: Id;
  projectId: Id;
  fromDeviceId?: Id;
  fromLabel?: string;
  fromPort?: string;
  toDeviceId?: Id;
  toLabel?: string;
  toPort?: string;
  signalType: SignalType;
  cableLabel?: string;
  // Optional geometry for the line drawn on a drawing.
  documentId?: Id;
  page?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
}

export type AnnotationKind = 'label' | 'rack' | 'connection' | 'note';

/**
 * The bridge between a location on a drawing and a structured entity.
 * `x`/`y` are normalized (0..1) relative to the page so they survive zoom.
 */
export interface Annotation {
  id: Id;
  projectId: Id;
  documentId: Id;
  page: number;
  x: number;
  y: number;
  kind: AnnotationKind;
  text?: string;
  /** Optional link to a Rack / RackEquipment / Connection id. */
  linkedEntityId?: Id;
}
