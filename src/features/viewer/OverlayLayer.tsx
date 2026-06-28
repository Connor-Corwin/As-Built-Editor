import { Stage, Layer, Rect, Line, Circle, Text, Group } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { HighlightRect } from '../../lib/pdf';
import type { Connection, Point } from '../../db/models';
import { SIGNAL_COLORS } from '../../lib/signalColors';
import type { EditTool } from '../../store/useAppStore';

interface Props {
  width: number;
  height: number;
  highlights?: HighlightRect[];
  activeIndex?: number;
  /** Points (nodes) on this page. */
  points?: Point[];
  /** Connections whose endpoints are points on this page. */
  connections?: Connection[];
  editMode?: boolean;
  editTool?: EditTool;
  selectedPointId?: string | null;
  selectedConnectionId?: string | null;
  /** Pending source point while linking with the connect tool. */
  connectFrom?: string | null;
  onAddPoint?: (nx: number, ny: number) => void;
  onMovePoint?: (id: string, nx: number, ny: number) => void;
  onSelectPoint?: (id: string) => void;
  onConnectClick?: (id: string) => void;
  onSelectConnection?: (id: string) => void;
  onBackground?: () => void;
}

const POINT_BLUE = '#0284c7';
const RACK_GREEN = '#059669';

/**
 * Transparent canvas over the rendered PDF page. Renders the editable copy
 * (points + connection links) and search highlights, and handles editing
 * interactions when `editMode` is on. Coordinates are normalized (0..1).
 */
export function OverlayLayer({
  width,
  height,
  highlights = [],
  activeIndex = -1,
  points = [],
  connections = [],
  editMode = false,
  editTool = 'select',
  selectedPointId = null,
  selectedConnectionId = null,
  connectFrom = null,
  onAddPoint,
  onMovePoint,
  onSelectPoint,
  onConnectClick,
  onSelectConnection,
  onBackground,
}: Props) {
  const pos = new Map(points.map((p) => [p.id, { x: p.x * width, y: p.y * height }]));

  function handleStageClick(e: KonvaEventObject<MouseEvent | TouchEvent>) {
    const stage = e.target.getStage();
    if (!stage || e.target !== stage) return; // only empty-canvas clicks
    if (editMode && editTool === 'point' && onAddPoint) {
      const p = stage.getPointerPosition();
      if (p) onAddPoint(p.x / width, p.y / height);
    } else {
      onBackground?.();
    }
  }

  return (
    <div
      className="absolute inset-0"
      style={{
        width,
        height,
        pointerEvents: editMode ? 'auto' : 'none',
        cursor: editMode && editTool === 'point' ? 'crosshair' : 'default',
      }}
    >
      <Stage
        width={width}
        height={height}
        onClick={handleStageClick}
        onTap={handleStageClick}
      >
        <Layer listening={editMode}>
          {/* Connection links between points */}
          {connections.map((c) => {
            const a = c.fromPointId ? pos.get(c.fromPointId) : undefined;
            const b = c.toPointId ? pos.get(c.toPointId) : undefined;
            if (!a || !b) return null;
            const sel = c.id === selectedConnectionId;
            return (
              <Line
                key={c.id}
                points={[a.x, a.y, b.x, b.y]}
                stroke={SIGNAL_COLORS[c.signalType]}
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

          {/* Cable labels at link midpoints */}
          {connections.map((c) => {
            const a = c.fromPointId ? pos.get(c.fromPointId) : undefined;
            const b = c.toPointId ? pos.get(c.toPointId) : undefined;
            if (!a || !b || !c.cableLabel) return null;
            return (
              <Text
                key={`${c.id}-lbl`}
                x={(a.x + b.x) / 2 + 4}
                y={(a.y + b.y) / 2 - 6}
                text={c.cableLabel}
                fontSize={11}
                fill="#0f172a"
                listening={false}
              />
            );
          })}

          {/* Points */}
          {points.map((p) => {
            const pp = pos.get(p.id)!;
            const isRack = !!p.rackId;
            const sel = p.id === selectedPointId;
            const isConnSrc = p.id === connectFrom;
            const color = isRack ? RACK_GREEN : POINT_BLUE;
            return (
              <Group
                key={p.id}
                x={pp.x}
                y={pp.y}
                draggable={editMode && editTool === 'select'}
                onDragEnd={(e) => {
                  onMovePoint?.(
                    p.id,
                    e.target.x() / width,
                    e.target.y() / height,
                  );
                }}
                onClick={(e) => {
                  e.cancelBubble = true;
                  if (editTool === 'connect') onConnectClick?.(p.id);
                  else onSelectPoint?.(p.id);
                }}
                onTap={(e) => {
                  e.cancelBubble = true;
                  if (editTool === 'connect') onConnectClick?.(p.id);
                  else onSelectPoint?.(p.id);
                }}
              >
                <Circle
                  radius={sel || isConnSrc ? 9 : 7}
                  fill={color}
                  stroke={isConnSrc ? '#ea580c' : sel ? '#0f172a' : '#ffffff'}
                  strokeWidth={isConnSrc || sel ? 2.5 : 1.5}
                />
                {p.label && (
                  <Text
                    x={11}
                    y={-6}
                    text={p.label}
                    fontSize={12}
                    fill="#0f172a"
                    listening={false}
                  />
                )}
              </Group>
            );
          })}

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
