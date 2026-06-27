import { Stage, Layer, Rect } from 'react-konva';
import type { HighlightRect } from '../../lib/pdf';

interface Props {
  width: number;
  height: number;
  /** Search-match rectangles to highlight, in CSS pixels at the page scale. */
  highlights?: HighlightRect[];
}

/**
 * Transparent interactive canvas layered exactly over the rendered PDF page.
 *
 * Today it draws search highlights. It is sized to match the PDF canvas (CSS
 * pixels) and positioned on top of it, so the next phase can also place
 * draggable racks, connection callouts, and labels here — pixel-aligned with
 * the drawing — without restructuring the viewer.
 */
export function OverlayLayer({ width, height, highlights = [] }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0" style={{ width, height }}>
      <Stage width={width} height={height}>
        <Layer>
          {highlights.map((r, i) => (
            <Rect
              key={i}
              x={r.x}
              y={r.y}
              width={r.width}
              height={r.height}
              fill="#facc15"
              opacity={0.4}
              stroke="#ca8a04"
              strokeWidth={1}
              cornerRadius={2}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}
