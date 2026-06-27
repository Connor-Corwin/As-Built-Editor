import { useEffect, useRef, type RefObject } from 'react';

interface Options {
  /** The scrollable viewport element. */
  scrollRef: RefObject<HTMLElement | null>;
  /** The rendered PDF canvas (used to anchor the zoom focal point). */
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** Current effective scale. */
  scale: number;
  /** Called with the new scale; the app re-renders the page at that scale. */
  onScaleChange: (scale: number) => void;
  minScale?: number;
  maxScale?: number;
}

interface Anchor {
  /** Focal point in viewport (client) coords. */
  focalX: number;
  focalY: number;
  /** Fraction across/down the page that should stay under the focal point. */
  fx: number;
  fy: number;
}

/**
 * Pinch-to-zoom that RE-RENDERS the PDF (vector-sharp) instead of letting the
 * browser blur-stretch the bitmap. Handles two-finger touch pinch and
 * ctrl/⌘ + wheel (trackpad pinch). One-finger drag keeps native scrolling.
 *
 * Because the re-render is asynchronous, the focal point is preserved by
 * recording the grabbed page fraction and, once the canvas resizes, nudging the
 * scroll offset so that point stays under the fingers/cursor.
 */
export function useGestureZoom({
  scrollRef,
  canvasRef,
  scale,
  onScaleChange,
  minScale = 0.15,
  maxScale = 8,
}: Options) {
  // Keep the latest scale available to event listeners without re-binding them.
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  const pinchRef = useRef<{ startDist: number; startScale: number } | null>(null);
  const pendingAnchor = useRef<Anchor | null>(null);
  const rafRef = useRef<number | null>(null);
  const nextScaleRef = useRef<number | null>(null);

  // Stable callback ref.
  const onScaleChangeRef = useRef(onScaleChange);
  onScaleChangeRef.current = onScaleChange;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const clamp = (s: number) => Math.min(maxScale, Math.max(minScale, s));

    // Page fraction under a client point, based on the canvas rectangle.
    const fractionAt = (clientX: number, clientY: number): Anchor => {
      const canvas = canvasRef.current;
      const r = canvas?.getBoundingClientRect();
      const fx = r && r.width ? (clientX - r.left) / r.width : 0.5;
      const fy = r && r.height ? (clientY - r.top) / r.height : 0.5;
      return {
        focalX: clientX,
        focalY: clientY,
        fx: Math.min(1, Math.max(0, fx)),
        fy: Math.min(1, Math.max(0, fy)),
      };
    };

    const scheduleScale = (next: number) => {
      nextScaleRef.current = next;
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (nextScaleRef.current != null) {
          onScaleChangeRef.current(nextScaleRef.current);
          nextScaleRef.current = null;
        }
      });
    };

    const dist = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const mid = (t: TouchList) => ({
      x: (t[0].clientX + t[1].clientX) / 2,
      y: (t[0].clientY + t[1].clientY) / 2,
    });

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchRef.current = {
          startDist: dist(e.touches),
          startScale: scaleRef.current,
        };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      const p = pinchRef.current;
      if (e.touches.length === 2 && p) {
        e.preventDefault(); // stop the browser's blur-zoom
        const m = mid(e.touches);
        pendingAnchor.current = fractionAt(m.x, m.y);
        scheduleScale(clamp((p.startScale * dist(e.touches)) / p.startDist));
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinchRef.current = null;
    };

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return; // normal wheel = native scroll
      e.preventDefault();
      pendingAnchor.current = fractionAt(e.clientX, e.clientY);
      scheduleScale(clamp(scaleRef.current * Math.exp(-e.deltaY * 0.0015)));
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);
    el.addEventListener('wheel', onWheel, { passive: false });

    // When the canvas resizes (a re-render landed), keep the focal point fixed.
    const ro = new ResizeObserver(() => {
      const a = pendingAnchor.current;
      const canvas = canvasRef.current;
      if (!a || !canvas) return;
      const r = canvas.getBoundingClientRect();
      el.scrollLeft += r.left + a.fx * r.width - a.focalX;
      el.scrollTop += r.top + a.fy * r.height - a.focalY;
      pendingAnchor.current = null;
    });
    if (canvasRef.current) ro.observe(canvasRef.current);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      el.removeEventListener('wheel', onWheel);
      ro.disconnect();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [scrollRef, canvasRef, minScale, maxScale]);
}
