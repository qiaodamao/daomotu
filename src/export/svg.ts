/**
 * SVG 导出：mm 单位（1 user unit = 1mm），按图层分组
 * cut 红实线 / crease 蓝虚线 / perf 点划线，兼容 AI / 浏览器直接打开
 * 可选尺寸标注（dim 图层，内容跟随 DimOptions）
 */
import { bbox, DielineResult, Entity, Layer, r3 } from '../engine/types';
import { computeDimMarks, DimMark, DimOptions } from '../engine/dims';

const LAYER_STYLE: Record<Layer, { color: string; dash?: string }> = {
  cut: { color: '#e11d48' },
  crease: { color: '#2563eb', dash: '6,3' },
  perf: { color: '#64748b', dash: '2,2' },
  dim: { color: '#94a3b8' },
};

function entityToPath(e: Entity): string {
  if (e.kind === 'line') {
    return `M ${r3(e.a.x)} ${r3(e.a.y)} L ${r3(e.b.x)} ${r3(e.b.y)}`;
  }
  if (e.kind === 'circle') {
    return `M ${r3(e.c.x - e.r)} ${r3(e.c.y)} a ${r3(e.r)} ${r3(e.r)} 0 1 0 ${r3(2 * e.r)} 0 a ${r3(e.r)} ${r3(e.r)} 0 1 0 ${r3(-2 * e.r)} 0`;
  }
  // arc → path A：a0→a1 数学正方向（y-down 屏幕系为顺时针 → SVG sweep=1）
  const { c, r, a0, a1 } = e;
  const p0 = { x: c.x + r * Math.cos((a0 * Math.PI) / 180), y: c.y + r * Math.sin((a0 * Math.PI) / 180) };
  const p1 = { x: c.x + r * Math.cos((a1 * Math.PI) / 180), y: c.y + r * Math.sin((a1 * Math.PI) / 180) };
  const largeArc = ((a1 - a0) % 360 + 360) % 360 > 180 ? 1 : 0;
  return `M ${r3(p0.x)} ${r3(p0.y)} A ${r3(r)} ${r3(r)} 0 ${largeArc} 1 ${r3(p1.x)} ${r3(p1.y)}`;
}

/** 尺寸标注 → <g id="dim">（线灰细，文字深灰居中，竖排旋转 -90°） */
function dimsToSvg(marks: DimMark[]): string {
  if (!marks.length) return '';
  const ln = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    `    <line x1="${r3(a.x)}" y1="${r3(a.y)}" x2="${r3(b.x)}" y2="${r3(b.y)}"/>`;
  const items = marks
    .map((m) => {
      const lines = [ln(m.a, m.b), ...(m.ext ?? []).map(([a, b]) => ln(a, b))].join('\n');
      const rot = m.vertical ? ` transform="rotate(-90 ${r3(m.tx)} ${r3(m.ty)})"` : '';
      const text = `    <text x="${r3(m.tx)}" y="${r3(m.ty)}"${rot} font-size="5" font-family="Helvetica, Arial, sans-serif" fill="#475569" stroke="none" text-anchor="middle" dominant-baseline="central">${m.text}</text>`;
      return `${lines}\n${text}`;
    })
    .join('\n');
  return `  <g id="dim" stroke="#94a3b8" stroke-width="0.15" fill="none">\n${items}\n  </g>`;
}

export function toSVG(result: DielineResult, dims?: DimOptions): string {
  const bb = bbox(result.entities);
  const marks = dims ? computeDimMarks(result, dims) : [];
  // 整体尺寸画在幅面外侧（下方/右侧），viewBox 需外扩
  const pad = dims?.overall ? 12 : 0;
  const w = r3(bb.max.x - bb.min.x + pad);
  const h = r3(bb.max.y - bb.min.y + pad);
  const ox = -bb.min.x;
  const oy = -bb.min.y;

  const groups = (['cut', 'crease', 'perf'] as Layer[])
    .map((layer) => {
      const ents = result.entities.filter((e) => e.layer === layer);
      if (!ents.length) return '';
      const style = LAYER_STYLE[layer];
      const d = ents.map(entityToPath).join(' ');
      return `  <g id="${layer}" stroke="${style.color}" stroke-width="0.3" fill="none"${
        style.dash ? ` stroke-dasharray="${style.dash}"` : ''
      }>\n    <path d="${d}"/>\n  </g>`;
    })
    .join('\n');
  const dimGroup = dimsToSvg(marks);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">
  <!-- 刀模图：单位 mm，图层 cut=裁切线 crease=压痕线 perf=齿刀 dim=尺寸标注 -->
  <g transform="translate(${r3(ox)} ${r3(oy)})">
${groups}
${dimGroup}
  </g>
</svg>
`;
}
