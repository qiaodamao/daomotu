/**
 * Canvas 2D 渲染器：线型分层 / 高 DPI / 缩放平移视图 / 尺寸标注
 * 线型规范（对齐行业惯例）：
 *   cut    裁切线  红色实线
 *   crease 压痕线  蓝色虚线
 *   perf   齿刀    灰色点划线
 * 尺寸标注：整体幅面（总宽/总高，幅面外侧）+ 各面宽深（面内，同尺寸面去重只标一个）
 */
import { bbox, DielineResult, Entity, Layer, PanelNode } from '../engine/types';

export interface ViewState {
  /** 屏幕像素 / mm */
  scale: number;
  ox: number;
  oy: number;
}

const COLORS: Record<Layer, string> = {
  cut: '#e11d48',
  crease: '#2563eb',
  perf: '#64748b',
  dim: '#94a3b8',
};

/** 计算适应视图（留 40px 边距） */
export function fitView(result: DielineResult, cw: number, ch: number): ViewState {
  const bb = bbox(result.entities);
  const bw = Math.max(bb.max.x - bb.min.x, 1);
  const bh = Math.max(bb.max.y - bb.min.y, 1);
  const m = 50; // 边距（含标注空间）
  const scale = Math.max(0.01, Math.min((cw - 2 * m) / bw, (ch - 2 * m) / bh));
  return {
    scale,
    ox: (cw - bw * scale) / 2 - bb.min.x * scale,
    oy: (ch - bh * scale) / 2 - bb.min.y * scale,
  };
}

/** 世界坐标 → 屏幕 CSS 像素 */
function toScreen(v: ViewState, x: number, y: number): [number, number] {
  return [x * v.scale + v.ox, y * v.scale + v.oy];
}

export interface DrawOptions {
  /** 整体幅面尺寸（总宽/总高） */
  showDim: boolean;
  /** 各面尺寸（同尺寸面去重只标一个） */
  showFaceDim: boolean;
  printMode: boolean;
}

export function draw(ctx: CanvasRenderingContext2D, result: DielineResult, view: ViewState, opts: DrawOptions) {
  const { width: cw, height: ch } = ctx.canvas;
  const dpr = window.devicePixelRatio || 1;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, cw, ch);

  const bb = bbox(result.entities);
  const m = { x: view.scale, y: view.scale };

  // 绘制顺序：crease → perf → cut（切线最醒目）
  const order: Layer[] = ['crease', 'perf', 'cut'];
  ctx.lineCap = 'round';
  for (const layer of order) {
    const ents = result.entities.filter((e) => e.layer === layer);
    if (!ents.length) continue;

    ctx.strokeStyle = opts.printMode ? '#111827' : COLORS[layer];
    ctx.lineWidth = layer === 'cut' ? 1.6 : 1.1;
    if (layer === 'crease') ctx.setLineDash([6, 4]);
    else if (layer === 'perf') ctx.setLineDash([2, 3]);
    else ctx.setLineDash([]);

    ctx.beginPath();
    for (const e of ents) {
      if (e.kind === 'line') {
        const [ax, ay] = toScreen(view, e.a.x, e.a.y);
        const [bx, by] = toScreen(view, e.b.x, e.b.y);
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
      } else if (e.kind === 'circle') {
        const [cx, cy] = toScreen(view, e.c.x, e.c.y);
        ctx.moveTo(cx + e.r * view.scale, cy);
        ctx.arc(cx, cy, e.r * view.scale, 0, Math.PI * 2);
      } else if (e.kind === 'arc') {
        const [cx, cy] = toScreen(view, e.c.x, e.c.y);
        ctx.arc(cx, cy, e.r * view.scale, (e.a0 * Math.PI) / 180, (e.a1 * Math.PI) / 180);
      }
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // 幅面外框已移除：裁切线轮廓本身即闭合边界，灰框与其重叠易误读为"未闭合"
  if (opts.showFaceDim) drawFaceDims(ctx, result, view, opts.printMode);
  if (opts.showDim) drawDims(ctx, bb, view, opts.printMode);
  void m; // （scale 由 view 直接携带）
}

/** 数值格式化：整数不带小数，否则保留 1 位 */
function fmtMm(v: number): string {
  const r = Math.round(v);
  return Math.abs(v - r) < 0.05 ? String(r) : String(Math.round(v * 10) / 10);
}

/** 45° 短斜线端点（建筑制图习惯） */
function tick45(ctx: CanvasRenderingContext2D, px: number, py: number) {
  ctx.beginPath();
  ctx.moveTo(px - 4, py + 4);
  ctx.lineTo(px + 4, py - 4);
  ctx.stroke();
}

/**
 * 各面尺寸标注：遍历 3D 面板树（与 2D 实体同源），按面包围盒宽×高去重，
 * 相同尺寸的面只标注首个代表面；宽标在面内上缘、高标在面内左缘
 */
function drawFaceDims(ctx: CanvasRenderingContext2D, result: DielineResult, view: ViewState, printMode: boolean) {
  const faces: { x0: number; y0: number; x1: number; y1: number; w: number; h: number }[] = [];
  const walk = (n: PanelNode) => {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const [x, y] of n.poly) {
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
    faces.push({ x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 });
    n.children.forEach(walk);
  };
  result.panels.forEach(walk);

  ctx.strokeStyle = printMode ? '#111827' : '#475569';
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.font = '13px "PingFang SC", "Microsoft YaHei", sans-serif';

  const seen = new Set<string>();
  for (const f of faces) {
    if (f.w < 6 || f.h < 6) continue; // 极小板不标（如插舌角部）
    const key = `${Math.round(f.w * 10)}x${Math.round(f.h * 10)}`;
    if (seen.has(key)) continue; // 同尺寸面只标一个代表
    seen.add(key);

    const [sx0, sy0] = toScreen(view, f.x0, f.y0);
    const [sx1, sy1] = toScreen(view, f.x1, f.y1);
    const off = 13; // 面内偏移（px）

    // 宽：面内上缘（屏幕上过窄时隐藏，放大后显示）
    if (f.w * view.scale >= 20) {
      const wy = sy0 + off;
      ctx.beginPath();
      ctx.moveTo(sx0, wy);
      ctx.lineTo(sx1, wy);
      ctx.stroke();
      tick45(ctx, sx0, wy);
      tick45(ctx, sx1, wy);
      drawLabel(ctx, `${fmtMm(f.w)} mm`, (sx0 + sx1) / 2, wy);
    }

    // 高：面内左缘（屏幕上过矮时隐藏，放大后显示）
    if (f.h * view.scale >= 20) {
      const wx = sx0 + off;
      ctx.beginPath();
      ctx.moveTo(wx, sy0);
      ctx.lineTo(wx, sy1);
      ctx.stroke();
      tick45(ctx, wx, sy0);
      tick45(ctx, wx, sy1);
      ctx.save();
      ctx.translate(wx, (sy0 + sy1) / 2);
      ctx.rotate(-Math.PI / 2);
      drawLabel(ctx, `${fmtMm(f.h)} mm`, 0, 0);
      ctx.restore();
    }
  }
}

/** 尺寸标注：总宽（下方）+ 总高（右侧） */
function drawDims(ctx: CanvasRenderingContext2D, bb: { min: { x: number; y: number }; max: { x: number; y: number } }, view: ViewState, printMode: boolean) {
  const [x0, y0] = toScreen(view, bb.min.x, bb.min.y);
  const [x1, y1] = toScreen(view, bb.max.x, bb.max.y);
  const wMm = Math.round(bb.max.x - bb.min.x);
  const hMm = Math.round(bb.max.y - bb.min.y);

  ctx.strokeStyle = printMode ? '#111827' : '#94a3b8'; // 标注线：浅灰（打印模式保持深色）
  ctx.fillStyle = '#0f172a'; // 标注文字颜色不变
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.font = '14px "PingFang SC", "Microsoft YaHei", sans-serif';

  // 总宽：下方
  const wy = y1 + 22;
  ctx.beginPath();
  ctx.moveTo(x0, wy);
  ctx.lineTo(x1, wy);
  ctx.moveTo(x0, y1);
  ctx.lineTo(x0, wy + 4);
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1, wy + 4);
  ctx.stroke();
  tick45(ctx, x0, wy);
  tick45(ctx, x1, wy);
  drawLabel(ctx, `${wMm} mm`, (x0 + x1) / 2, wy);

  // 总高：右侧
  const wx = x1 + 22;
  ctx.beginPath();
  ctx.moveTo(wx, y0);
  ctx.lineTo(wx, y1);
  ctx.moveTo(x1, y0);
  ctx.lineTo(wx + 4, y0);
  ctx.moveTo(x1, y1);
  ctx.lineTo(wx + 4, y1);
  ctx.stroke();
  tick45(ctx, wx, y0);
  tick45(ctx, wx, y1);
  ctx.save();
  ctx.translate(wx, (y0 + y1) / 2);
  ctx.rotate(-Math.PI / 2);
  drawLabel(ctx, `${hMm} mm`, 0, 0);
  ctx.restore();
}

function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  const w = ctx.measureText(text).width;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(x - w / 2 - 3, y - 8, w + 6, 16);
  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}
