/**
 * 尺寸标注几何计算（世界坐标 mm，y-down）
 * 供导出器（SVG / PDF / AI / DXF）共用：
 *   整体幅面尺寸（总宽在幅面下方 / 总高在右侧，带延伸线）
 *   各面尺寸（面内上缘标宽 / 左缘标高，同尺寸面去重只标一个）
 * 去重规则与 render2d 屏显标注一致（面包围盒宽×高，key 精确到 0.1mm，<6mm 面跳过）
 */
import { bbox, DielineResult, PanelNode } from './types';

export interface DimPt {
  x: number;
  y: number;
}

/** 一条尺寸标注：尺寸线 + 端点文字（+ 整体尺寸的延伸线） */
export interface DimMark {
  /** 尺寸线段 */
  a: DimPt;
  b: DimPt;
  /** 文字中心与内容 */
  text: string;
  tx: number;
  ty: number;
  /** 竖排（高度标注，文字沿线旋转 90°） */
  vertical: boolean;
  /** 延伸线（整体尺寸引出线） */
  ext?: [DimPt, DimPt][];
}

export interface DimOptions {
  /** 整体幅面尺寸（总宽/总高） */
  overall: boolean;
  /** 各面尺寸 */
  face: boolean;
}

/** 数值格式化：整数不带小数，否则保留 1 位 */
function fmtMm(v: number): string {
  const r = Math.round(v);
  return Math.abs(v - r) < 0.05 ? String(r) : String(Math.round(v * 10) / 10);
}

interface FaceBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  w: number;
  h: number;
}

function polyBBox(poly: [number, number][]): FaceBox {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of poly) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

export function computeDimMarks(result: DielineResult, opts: DimOptions): DimMark[] {
  const marks: DimMark[] = [];
  const bb = bbox(result.entities);

  if (opts.overall) {
    const off = 6; // 幅面外偏移
    const over = 2; // 延伸线超出尺寸线的长度
    const wMm = bb.max.x - bb.min.x;
    const hMm = bb.max.y - bb.min.y;
    // 总宽：幅面下方
    const y = bb.max.y + off;
    marks.push({
      a: { x: bb.min.x, y },
      b: { x: bb.max.x, y },
      text: `${Math.round(wMm)} mm`,
      tx: (bb.min.x + bb.max.x) / 2,
      ty: y + 3,
      vertical: false,
      ext: [
        [{ x: bb.min.x, y: bb.max.y }, { x: bb.min.x, y: y + over }],
        [{ x: bb.max.x, y: bb.max.y }, { x: bb.max.x, y: y + over }],
      ],
    });
    // 总高：幅面右侧
    const x = bb.max.x + off;
    marks.push({
      a: { x, y: bb.min.y },
      b: { x, y: bb.max.y },
      text: `${Math.round(hMm)} mm`,
      tx: x + 3,
      ty: (bb.min.y + bb.max.y) / 2,
      vertical: true,
      ext: [
        [{ x: bb.min.x, y: bb.min.y }, { x: x + over, y: bb.min.y }],
        [{ x: bb.min.x, y: bb.max.y }, { x: x + over, y: bb.max.y }],
      ],
    });
  }

  if (opts.face) {
    const faces: FaceBox[] = [];
    const walk = (n: PanelNode) => {
      faces.push(polyBBox(n.poly));
      n.children.forEach(walk);
    };
    result.panels.forEach(walk);

    const seen = new Set<string>();
    for (const f of faces) {
      if (f.w < 6 || f.h < 6) continue; // 极小板不标（与屏显一致）
      const key = `${Math.round(f.w * 10)}x${Math.round(f.h * 10)}`;
      if (seen.has(key)) continue; // 同尺寸面只标一个代表
      seen.add(key);
      const off = 3; // 面内偏移
      // 宽：面内上缘
      marks.push({
        a: { x: f.x0, y: f.y0 + off },
        b: { x: f.x1, y: f.y0 + off },
        text: `${fmtMm(f.w)} mm`,
        tx: (f.x0 + f.x1) / 2,
        ty: f.y0 + off + 2.6,
        vertical: false,
      });
      // 高：面内左缘
      marks.push({
        a: { x: f.x0 + off, y: f.y0 },
        b: { x: f.x0 + off, y: f.y1 },
        text: `${fmtMm(f.h)} mm`,
        tx: f.x0 + off + 2.6,
        ty: (f.y0 + f.y1) / 2,
        vertical: true,
      });
    }
  }

  return marks;
}
