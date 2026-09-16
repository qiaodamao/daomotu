/**
 * DXF R12 ASCII 导出（最小可靠子集，所有 CAD 软件可识别）
 * - y 轴翻转为 CAD 习惯的 y-up
 * - LAYER 表预定义图层：CUT(红) / CREASE(蓝) / PERF(灰) / DIM(灰，尺寸标注)
 * - 实体类型：LINE / ARC / CIRCLE / TEXT（尺寸标注用）
 */
import { DielineResult, Entity, r3 } from '../engine/types';
import { computeDimMarks, DimMark, DimOptions } from '../engine/dims';

const n = (v: number) => r3(v).toString();

function entityToDxf(e: Entity): string {
  if (e.kind === 'line') {
    // y 翻转：CAD y-up
    return [
      '0', 'LINE', '8', e.layer.toUpperCase(),
      '10', n(e.a.x), '20', n(-e.a.y), '30', '0.0',
      '11', n(e.b.x), '21', n(-e.b.y), '31', '0.0',
    ].join('\n');
  }
  if (e.kind === 'circle') {
    return ['0', 'CIRCLE', '8', e.layer.toUpperCase(), '10', n(e.c.x), '20', n(-e.c.y), '30', '0.0', '40', n(e.r)].join('\n');
  }
  // arc：y 翻转后角度 θ → -θ，区间方向保持逆时针
  const a0n = ((-e.a1 % 360) + 360) % 360;
  const a1n = ((-e.a0 % 360) + 360) % 360;
  return [
    '0', 'ARC', '8', e.layer.toUpperCase(),
    '10', n(e.c.x), '20', n(-e.c.y), '30', '0.0',
    '40', n(e.r), '50', n(a0n), '51', n(a1n),
  ].join('\n');
}

/** 尺寸标注 → LINE（尺寸线+延伸线）+ TEXT 实体（DIM 图层，y 翻转） */
function dimsToDxf(marks: DimMark[]): string {
  const out: string[] = [];
  const line = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    out.push(['0', 'LINE', '8', 'DIM', '10', n(a.x), '20', n(-a.y), '30', '0.0', '11', n(b.x), '21', n(-b.y), '31', '0.0'].join('\n'));
  };
  for (const m of marks) {
    line(m.a, m.b);
    for (const [a, b] of m.ext ?? []) line(a, b);
    // TEXT：字高 3.2mm；文字宽按 0.6 字高/字符估算居中；竖排旋转 90°（CAD 逆时针）
    const h = 3.2;
    const tw = m.text.length * h * 0.6;
    const x = m.vertical ? m.tx - h * 0.35 : m.tx - tw / 2;
    const y = m.vertical ? -m.ty - tw / 2 : -m.ty - h * 0.35;
    out.push(
      ['0', 'TEXT', '8', 'DIM', '10', n(x), '20', n(y), '30', '0.0', '40', n(h), '1', m.text, '50', m.vertical ? '90' : '0'].join('\n'),
    );
  }
  return out.join('\n');
}

function layerTable(): string {
  const layers = [
    ['CUT', 1], // 红
    ['CREASE', 5], // 蓝
    ['PERF', 8], // 灰
    ['DIM', 8], // 灰（尺寸标注）
  ];
  const rows = layers
    .map(([name, color]) => ['0', 'LAYER', '2', name, '70', '0', '62', String(color), '6', 'CONTINUOUS'].join('\n'))
    .join('\n');
  return ['0', 'TABLE', '2', 'LAYER', '70', String(layers.length), rows, '0', 'ENDTAB'].join('\n');
}

export function toDXF(result: DielineResult, dims?: DimOptions): string {
  const marks = dims ? computeDimMarks(result, dims) : [];
  const body = [...result.entities.map(entityToDxf), ...(marks.length ? [dimsToDxf(marks)] : [])].join('\n');
  return [
    // HEADER
    '0', 'SECTION', '2', 'HEADER',
    '9', '$ACADVER', '1', 'AC1009', // R12
    '9', '$MEASUREMENT', '70', '1', // 公制
    '0', 'ENDSEC',
    // TABLES（图层定义）
    '0', 'SECTION', '2', 'TABLES',
    layerTable(),
    '0', 'ENDSEC',
    // ENTITIES
    '0', 'SECTION', '2', 'ENTITIES',
    body,
    '0', 'ENDSEC',
    '0', 'EOF',
  ].join('\n');
}
