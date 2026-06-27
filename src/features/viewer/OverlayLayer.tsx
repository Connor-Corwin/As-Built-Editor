import { Stage, Layer } from 'react-konva';

interface Props {
  width: number;
  height: number;
}

/**
 * Transparent interactive canvas layered exactly over the rendered PDF page.
 *
 * MVP: intentionally empty. It is sized to match the PDF canvas (CSS pixels)
 * and positioned on top of it, so the next phase can place draggable racks,
 * connection callouts, and labels here — pixel-aligned with the drawing —
 * without restructuring the viewer.
 */
export function OverlayLayer({ width, height }: Props) {
  return (
    <div
      className="pointer-events-none absolute inset-0"
      // Konva attaches its own DOM; sizing the wrapper keeps it aligned.
      style={{ width, height }}
    >
      <Stage width={width} height={height}>
        <Layer>{/* Editing primitives (racks/connections/labels) go here. */}</Layer>
      </Stage>
    </div>
  );
}
