import { Stage, Layer, Rect, Line, Circle, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { HighlightRect } from '../../lib/pdf';
import type { Connection } from '../../db/models';
import { SIGNAL_COLORS } from '../../lib/signalColors';

interface Props {
  width: number;
  height: number;
  /** Search-match rectangles to highlight, in CSS pixels at the page scale. */
  highlights?: HighlightRect[];
  /** Index within `highlights` of the currently focused match. */
  activeIndex?: number;
  /** Connections drawn on this page (have geometry). */
  connections?: Connection[];
  selectedConnectionId?: string | null;
  /** True while placing/selecting connections (makes the overlay interactive). */
  connectionMode?: boolean;
  /** First point placed while drawing (normalized 0..1), awaiting the second. */
  pendingStart?: { x: number; y: number } | null;
  /** Background click at a normalized point (used to place connection ends). */
  onPlacePoint?: (nx: number, ny: number) => void;
  onSelectConnection?: (id: string) => void;
}

/**
 * Transparent canvas layered exactly over the rendered PDF page. Draws search
 * highlights and connection lines, and (in connection mode) handles clicks to
 * place/select connections — pixel-aligned with the drawing.
 */
export function OverlayLayer({
  width,
  height,
  highlights = [],
  activeIndex = -1,
  connections = [],
  selectedConnectionId = null,
  connectionMode = false,
  pendingStart = null,
  onPlacePoint,
  onSelectConnection,
}: Props) {
  function handleStageClick(e: KonvaEventObject<MouseEvent | TouchEvent>) {
    if (!connectionMode || !onPlacePoint) return;
    const stage = e.target.getStage();
    // Only treat clicks on empty canvas (not on a line) as point placement.
    if (!stage || e.target !== stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    onPlacePoint(pos.x / width, pos.y / height);
  }

  return (
    <div
      className="absolute inset-0"
      style={{
        width,
        height,
        pointerEvents: connectionMode ? 'auto' : 'none',
        cursor: connectionMode ? 'crosshair' : 'default',
      }}
    >
      <Stage
        width={width}
        height={height}
        onClick={handleStageClick}
        onTap={handleStageClick}
      >
        <Layer listening={connectionMode}>
          {/* Connection lines */}
          {connections.map((c) => {
            if (
              c.x1 == null ||
              c.y1 == null ||
              c.x2 == null ||
              c.y2 == null
            )
              return null;
            const color = SIGNAL_COLORS[c.signalType];
            const sel = c.id === selectedConnectionId;
            const p = [c.x1 * width, c.y1 * height, c.x2 * width, c.y2 * height];
            return (
              <Line
                key={c.id}
                points={p}
                stroke={color}
                strokeWidth={sel ? 4 : 2}
                hitStrokeWidth={16}
                opacity={0.9}
                onClick={(e) => {
                  e.cancelBubble = true;
                  onSelectConnection?.(c.id);
                }}
                onTap={(e) => {
                  e.cancelBubble = true;
                  onSelectConnection?.(c.id);
                }}
              />
            );
          })}
          {/* Endpoint dots (above the lines) */}
          {connections.flatMap((c) => {
            if (c.x1 == null || c.y1 == null || c.x2 == null || c.y2 == null)
              return [];
            const color = SIGNAL_COLORS[c.signalType];
            const r = c.id === selectedConnectionId ? 5 : 3.5;
            return [
              <Circle
                key={`${c.id}-a`}
                x={c.x1 * width}
                y={c.y1 * height}
                radius={r}
                fill={color}
                listening={false}
              />,
              <Circle
                key={`${c.id}-b`}
                x={c.x2 * width}
                y={c.y2 * height}
                radius={r}
                fill={color}
                listening={false}
              />,
            ];
          })}
          {connections.map((c) =>
            c.cableLabel && c.x1 != null && c.x2 != null && c.y1 != null && c.y2 != null ? (
              <Text
                key={`${c.id}-lbl`}
                x={((c.x1 + c.x2) / 2) * width + 4}
                y={((c.y1 + c.y2) / 2) * height - 6}
                text={c.cableLabel}
                fontSize={11}
                fill="#0f172a"
                listening={false}
              />
            ) : null,
          )}

          {/* Pending first point while drawing */}
          {pendingStart && (
            <Circle
              x={pendingStart.x * width}
              y={pendingStart.y * height}
              radius={5}
              fill="#0ea5e9"
              stroke="#0369a1"
              strokeWidth={1}
              listening={false}
            />
          )}

          {/* Search highlights */}
          {highlights.map((r, i) => (
            <Rect
              key={i}
              x={r.x}
              y={r.y}
              width={r.width}
              height={r.height}
              fill={i === activeIndex ? '#f97316' : '#facc15'}
              opacity={i === activeIndex ? 0.55 : 0.4}
              stroke={i === activeIndex ? '#c2410c' : '#ca8a04'}
              strokeWidth={i === activeIndex ? 2 : 1}
              cornerRadius={2}
              listening={false}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}
