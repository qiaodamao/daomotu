/**
 * 画布视图：Canvas 2D 渲染 + 交互（滚轮缩放 / 双指捏合 / 拖拽平移 / 适应视图）
 */
import { useCallback, useEffect, useRef } from 'react';
import { DielineResult } from '../engine/types';
import { draw, fitView, ViewState } from '../render/render2d';
import { useStore } from '../store';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function CanvasView({ result, fitSignal }: { result: DielineResult; fitSignal: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<ViewState>({ scale: 1, ox: 0, oy: 0 });
  const rafRef = useRef(0);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ dist: number; cx: number; cy: number } | null>(null);
  const showDim = useStore((s) => s.showDim);
  const showFaceDim = useStore((s) => s.showFaceDim);
  const printMode = useStore((s) => s.printMode);

  const redraw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    draw(ctx, result, viewRef.current, { showDim, showFaceDim, printMode });
  }, [result, showDim, showFaceDim, printMode]);

  // 始终指向最新 redraw（避免闭包失效）
  const redrawRef = useRef(redraw);
  redrawRef.current = redraw;

  const scheduleRedraw = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => redrawRef.current());
  }, []);

  // 容器尺寸自适应（高 DPI）
  useEffect(() => {
    const wrap = wrapRef.current;
    const cv = canvasRef.current;
    if (!wrap || !cv) return;
    // RO 的首次回调要等一次渲染时机：从 3D 视图切回来时可能不来，
    // 那时 canvas 会停在默认 300×150（CSS 不拉伸）→ 刀版图空白，故先同步量一次
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      cv.width = Math.max(1, Math.round(wrap.clientWidth * dpr));
      cv.height = Math.max(1, Math.round(wrap.clientHeight * dpr));
      cv.style.width = `${wrap.clientWidth}px`;
      cv.style.height = `${wrap.clientHeight}px`;
      scheduleRedraw();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [scheduleRedraw]);

  // fit 信号（初始 / 盒型切换 / 手动触发）
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    viewRef.current = fitView(result, wrap.clientWidth, wrap.clientHeight);
    scheduleRedraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitSignal]);

  // 参数变化：保持视图重绘
  useEffect(() => {
    scheduleRedraw();
  }, [result, showDim, showFaceDim, printMode, scheduleRedraw]);

  // 滚轮缩放（光标为锚点；须 non-passive 才能 preventDefault）
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = cv.getBoundingClientRect();
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.0012));
    };
    cv.addEventListener('wheel', onWheel, { passive: false });
    return () => cv.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleRedraw]);

  // 以视口坐标点为锚缩放视图，并累加平移
  const zoomAt = (sx: number, sy: number, factor: number, panX = 0, panY = 0) => {
    const v = viewRef.current;
    const ns = clamp(v.scale * factor, 0.02, 50);
    v.ox = sx - ((sx - v.ox) / v.scale) * ns + panX;
    v.oy = sy - ((sy - v.oy) / v.scale) * ns + panY;
    v.scale = ns;
    scheduleRedraw();
  };

  return (
    <div ref={wrapRef} className="canvas-wrap">
      <canvas
        ref={canvasRef}
        className="canvas"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pointersRef.current.size === 2) {
            const [p1, p2] = [...pointersRef.current.values()];
            pinchRef.current = { dist: Math.hypot(p2.x - p1.x, p2.y - p1.y), cx: (p1.x + p2.x) / 2, cy: (p1.y + p2.y) / 2 };
            dragRef.current = null;
          } else {
            dragRef.current = { x: e.clientX, y: e.clientY };
          }
        }}
        onPointerMove={(e) => {
          const pts = pointersRef.current;
          if (!pts.has(e.pointerId)) return;
          pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pts.size >= 2 && pinchRef.current) {
            const [p1, p2] = [...pts.values()];
            const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            const cx = (p1.x + p2.x) / 2;
            const cy = (p1.y + p2.y) / 2;
            const base = pinchRef.current;
            if (base.dist > 0) {
              const rect = canvasRef.current!.getBoundingClientRect();
              zoomAt(cx - rect.left, cy - rect.top, dist / base.dist, cx - base.cx, cy - base.cy);
            }
            pinchRef.current = { dist, cx, cy };
            return;
          }
          const d = dragRef.current;
          if (!d) return;
          viewRef.current.ox += e.clientX - d.x;
          viewRef.current.oy += e.clientY - d.y;
          dragRef.current = { x: e.clientX, y: e.clientY };
          scheduleRedraw();
        }}
        onPointerUp={(e) => {
          pointersRef.current.delete(e.pointerId);
          pinchRef.current = null;
          // 双指剩单指时以剩余手指为拖拽起点，避免视图跳变
          if (pointersRef.current.size === 1) {
            const [p] = [...pointersRef.current.values()];
            dragRef.current = { x: p.x, y: p.y };
          } else {
            dragRef.current = null;
          }
        }}
        onPointerCancel={(e) => {
          pointersRef.current.delete(e.pointerId);
          pinchRef.current = null;
          const rest = [...pointersRef.current.values()];
          dragRef.current = rest.length === 1 ? { x: rest[0].x, y: rest[0].y } : null;
        }}
      />
      <div className="canvas-hint">滚轮/双指缩放 · 拖拽平移</div>
    </div>
  );
}
