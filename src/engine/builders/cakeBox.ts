/**
 * 提手飞机盒（蛋糕/外卖手提盒）
 * 0427 飞机盒结构（顶部插舌盖 + 底部全底板）+ 顶主盖冲跑道形提手孔。
 * 主盖折合后提手孔位于盒顶中央，孔高即手提空间。
 */
import { BoxParams, commonWarnings, toMakeSize, COMMON_FIELDS, FieldSpec } from '../params';
import { bbox, DielineResult, Entity, PanelNode, r3 } from '../types';
import { tubeWithEnds } from './shared';

const fields: FieldSpec[] = [
  ...COMMON_FIELDS,
  { key: 'tongue', label: '插舌深度', type: 'number', unit: 'mm', min: 4, max: 40, group: '工艺参数' },
  { key: 'handleW', label: '提手宽（0=自动）', type: 'number', unit: 'mm', min: 0, max: 1900, group: '提手' },
  { key: 'handleH', label: '提手高', type: 'number', unit: 'mm', min: 15, max: 60, group: '提手' },
];

/**
 * 跑道形提手孔 2D 实体（cut 层，闭合轮廓）：
 * 两条水平切线 + 左右两段半圆弧（y-down：左弧 90°→270° 经左，右弧 -90°→90° 经右）
 */
function handleEntities(cx: number, cy: number, w: number, h: number): Entity[] {
  const rw = Math.max(0, (w - h) / 2); // 直段半长
  const r = h / 2;
  return [
    { kind: 'line', layer: 'cut', a: { x: r3(cx - rw), y: r3(cy - r) }, b: { x: r3(cx + rw), y: r3(cy - r) } },
    { kind: 'line', layer: 'cut', a: { x: r3(cx - rw), y: r3(cy + r) }, b: { x: r3(cx + rw), y: r3(cy + r) } },
    { kind: 'arc', layer: 'cut', c: { x: r3(cx - rw), y: r3(cy) }, r: r3(r), a0: 90, a1: 270 },
    { kind: 'arc', layer: 'cut', c: { x: r3(cx + rw), y: r3(cy) }, r: r3(r), a0: 270, a1: 90 },
  ];
}

/** 面板树中找 tuck 主盖（cover-t）并加提手孔（6 点多边形近似跑道形，与 2D 同位） */
function addHandleHole(trees: PanelNode[], cx: number, cy: number, w: number, h: number): boolean {
  const rw = Math.max(0, (w - h) / 2);
  const r = h / 2;
  const hole: [number, number][] = [
    [cx - rw, cy - r],
    [cx - rw - r, cy],
    [cx - rw, cy + r],
    [cx + rw, cy + r],
    [cx + rw + r, cy],
    [cx + rw, cy - r],
  ].map(([x, y]) => [r3(x), r3(y)]) as [number, number][];
  const walk = (nodes: PanelNode[]): boolean => {
    for (const n of nodes) {
      if (n.id === 'cover-t') {
        n.holes = [...(n.holes ?? []), hole];
        return true;
      }
      if (walk(n.children)) return true;
    }
    return false;
  };
  return walk(trees);
}

export const cakeBox = {
  id: 'cake-box',
  name: '提手飞机盒（手提孔）',
  category: '快递 / 电商',
  fields,
  build(p: BoxParams): DielineResult {
    const make = toMakeSize(p);
    const g = p.glueFlap;
    const tongue = p.tongue;

    const { entities, panels, TW, TH } = tubeWithEnds({
      L: make.l,
      W: make.w,
      H: make.h,
      g,
      ch: p.chamfer,
      top: { type: 'tuck', tongue },
      bottom: { type: 'fullBase' },
    });

    // 提手孔：主盖（col2 区）中央。tuck 顶部端部高 = W + tongue（T 为折线 y），
    // 主盖 2D y ∈ [T-W, T]；孔中心取主盖中央
    const T = make.w + tongue;
    const coverX0 = g + make.w;
    const coverX1 = g + make.w + make.l;
    const cx = (coverX0 + coverX1) / 2;
    const cy = T - make.w / 2;

    // 孔尺寸（钳制在主盖安全范围内：四周边距 ≥ 12mm）
    const maxW = Math.max(20, coverX1 - coverX0 - 24);
    const maxH = Math.max(15, make.w - 24);
    const autoW = p.handleW > 0 ? p.handleW : Math.min(make.l * 0.55, 90);
    const hw = Math.min(autoW, maxW);
    const hh = Math.min(Math.max(p.handleH, 15), maxH);

    entities.push(...handleEntities(cx, cy, hw, hh));
    addHandleHole(panels, cx, cy, hw, hh);

    const bb = bbox(entities);
    const warnings = [...commonWarnings(p, make)];
    if (p.tongue < 8) warnings.push('插舌深度 < 8mm，封口易松脱');
    if (hw < 60) warnings.push('提手宽 < 60mm，长时间手提舒适度差');
    if (hh < 25) warnings.push('提手高 < 25mm，手指空间偏紧');
    if (make.h < 25) warnings.push('盒高偏小，底部结构可能过挤，建议打样确认');
    warnings.push('提手孔需模切冲孔工艺（孔内废料清废）');

    return {
      entities,
      panels,
      meta: {
        makeSize: make,
        unfold: { w: bb.max.x - bb.min.x, h: bb.max.y - bb.min.y },
        areaM2: (TW * TH) / 1e6,
        warnings,
      },
    };
  },
};
