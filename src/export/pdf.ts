/**
 * PDF 导出（pdf-lib，1:1 毫米矢量）
 * - 页面尺寸 = 展开幅面（mm → pt：1mm = 72/25.4 pt）
 * - 线型同屏显规范：cut 红 / crease 蓝虚线
 * - 可选尺寸标注（内容跟随 DimOptions；AI 导出同源自动生效）
 */
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import { bbox, DielineResult, Entity } from '../engine/types';
import { computeDimMarks, DimOptions } from '../engine/dims';

const MM = 72 / 25.4; // mm → pt

interface LineSeg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  layer: string;
}

/** 弧 → 16 段折线近似（pdf-lib 无原生 arc） */
function arcToSegs(e: Extract<Entity, { kind: 'arc' }>): LineSeg[] {
  const segs: LineSeg[] = [];
  const n = 16;
  const pt = (deg: number) => ({
    x: e.c.x + e.r * Math.cos((deg * Math.PI) / 180),
    y: e.c.y + e.r * Math.sin((deg * Math.PI) / 180),
  });
  let prev = pt(e.a0);
  for (let i = 1; i <= n; i++) {
    const a = e.a0 + ((e.a1 - e.a0) * i) / n;
    const cur = pt(a);
    segs.push({ x1: prev.x, y1: prev.y, x2: cur.x, y2: cur.y, layer: e.layer });
    prev = cur;
  }
  return segs;
}

export async function toPDF(result: DielineResult, dims?: DimOptions): Promise<Uint8Array> {
  const bb = bbox(result.entities);
  const wMm = Math.max(1, bb.max.x - bb.min.x);
  const hMm = Math.max(1, bb.max.y - bb.min.y);
  const marks = dims ? computeDimMarks(result, dims) : [];
  // 整体尺寸画在幅面外侧（下方/右侧），页面需外扩
  const pad = dims?.overall ? 12 : 0;

  // 汇总线段
  const segs: LineSeg[] = [];
  for (const e of result.entities) {
    if (e.kind === 'line') segs.push({ x1: e.a.x, y1: e.a.y, x2: e.b.x, y2: e.b.y, layer: e.layer });
    else if (e.kind === 'arc') segs.push(...arcToSegs(e));
    else if (e.kind === 'circle') {
      segs.push(...arcToSegs({ ...e, kind: 'arc', a0: 0, a1: 360 }));
    }
  }

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([(wMm + pad) * MM, (hMm + pad) * MM]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  // PDF 坐标 y-up：翻转 + 平移到包围盒；页底预留 pad（整体尺寸画在幅面下方，避免落到页面外）
  const py = (y: number) => (bb.max.y - y + pad) * MM;

  // 免责声明页脚（行业惯例）
  // 注：pdf-lib 内置字体仅支持 WinAnsi 编码，不能用中文；如需中文页脚须嵌入字体子集
  page.drawText('For reference only. Final dieline subject to factory confirmation. - Daomotu', {
    x: 4,
    y: 4,
    size: 5,
    color: rgb(0.6, 0.6, 0.6),
  });

  const styleOf = (layer: string) => {
    if (layer === 'cut') return { color: rgb(0.88, 0.11, 0.28), thickness: 0.3, dash: undefined as number[] | undefined };
    if (layer === 'crease') return { color: rgb(0.15, 0.39, 0.92), thickness: 0.25, dash: [2, 1.2] };
    return { color: rgb(0.4, 0.4, 0.4), thickness: 0.25, dash: [1, 1] };
  };

  for (const s of segs) {
    const st = styleOf(s.layer);
    page.drawLine({
      start: { x: (s.x1 - bb.min.x) * MM, y: py(s.y1) },
      end: { x: (s.x2 - bb.min.x) * MM, y: py(s.y2) },
      thickness: st.thickness * MM,
      color: st.color,
      dashArray: st.dash ? st.dash.map((d) => d * MM) : undefined,
    });
  }

  // 尺寸标注：灰细线 + 文字（标注文字为 ASCII 数字，内置字体可覆盖）
  const dimColor = rgb(0.45, 0.5, 0.58);
  const dimSize = 5 * MM; // 字高 pt（5mm，大幅面刀模图可读）
  for (const m of marks) {
    const lines: [typeof m.a, typeof m.b][] = [[m.a, m.b], ...(m.ext ?? [])];
    for (const [a, b] of lines) {
      page.drawLine({
        start: { x: (a.x - bb.min.x) * MM, y: py(a.y) },
        end: { x: (b.x - bb.min.x) * MM, y: py(b.y) },
        thickness: 0.15 * MM,
        color: dimColor,
      });
    }
    const tw = font.widthOfTextAtSize(m.text, dimSize);
    const cx = (m.tx - bb.min.x) * MM;
    const cy = py(m.ty);
    if (m.vertical) {
      // 竖排：绕文字中心旋转 90°（PDF y-up），基线起点 = 中心下移半个字宽、左移半个字高
      page.drawText(m.text, { x: cx - dimSize * 0.35, y: cy - tw / 2, size: dimSize, font, color: dimColor, rotate: degrees(90) });
    } else {
      page.drawText(m.text, { x: cx - tw / 2, y: cy - dimSize * 0.35, size: dimSize, font, color: dimColor });
    }
  }

  return pdf.save();
}
