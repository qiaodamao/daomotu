/**
 * 画布视图：Canvas 2D 渲染 + 交互（滚轮缩放 / 拖拽平移 / 适应视图）
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
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      cv.width = Math.max(1, Math.round(wrap.clientWidth * dpr));
      cv.height = Math.max(1, Math.round(wrap.clientHeight * dpr));
      cv.style.width = `${wrap.clientWidth}px`;
      cv.style.height = `${wrap.clientHeight}px`;
      scheduleRedraw();
    });
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
      const v = viewRef.current;
      const f = Math.exp(-e.deltaY * 0.0012);
      const ns = clamp(v.scale * f, 0.02, 50);
      const rect = cv.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      v.ox = sx - ((sx - v.ox) / v.scale) * ns;
      v.oy = sy - ((sy - v.oy) / v.scale) * ns;
      v.scale = ns;
      scheduleRedraw();
    };
    cv.addEventListener('wheel', onWheel, { passive: false });
    return () => cv.removeEventListener('wheel', onWheel);
  }, [scheduleRedraw]);

  return (
    <div ref={wrapRef} className="canvas-wrap">
      <canvas
        ref={canvasRef}
        className="canvas"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          dragRef.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          const d = dragRef.current;
          if (!d) return;
          viewRef.current.ox += e.clientX - d.x;
          viewRef.current.oy += e.clientY - d.y;
          dragRef.current = { x: e.clientX, y: e.clientY };
          scheduleRedraw();
        }}
        onPointerUp={() => (dragRef.current = null)}
        onPointerCancel={() => (dragRef.current = null)}
      />
      <div className="canvas-hint">滚轮缩放 · 拖拽平移</div>
    </div>
  );
}
