/**
 * 瓦楞提手箱（0201 变体）
 * 0201 开槽箱结构，顶部对合的两片外摇盖（t2/t4）各开半跑道槽：
 *   2D 上两半槽同位于 y ∈ [yc, yc+d]（yc = 折线 T − W/2，靠折线侧），
 *   折合后 t2 半槽落在箱口正面半（u ∈ [W/2−d, W/2]）、t4 落在背面半
 *   （u ∈ [W/2, W/2+d]），两开口边在对合中线相遇，拼成完整贯通提手孔。
 * 摇盖深自动加深（≥ W/2 + d + 3）保证孔完整落在摇盖内。
 */
import { BoxParams, commonWarnings, toMakeSize, COMMON_FIELDS, FieldSpec } from '../params';
import { bbox, DielineResult, Entity, PanelNode, r3 } from '../types';
import { tubeWithEnds } from './shared';

const fields: FieldSpec[] = [
  ...COMMON_FIELDS,
  { key: 'slot', label: '摇盖开槽', type: 'number', unit: 'mm', min: 0, max: 40, group: '工艺参数' },
  { key: 'flapGap', label: '摇盖修正', type: 'number', unit: 'mm', min: 0, max: 60, group: '工艺参数' },
  { key: 'handleW', label: '提手宽（0=自动）', type: 'number', unit: 'mm', min: 0, max: 1900, group: '提手' },
  { key: 'handleH', label: '提手高', type: 'number', unit: 'mm', min: 15, max: 60, group: '提手' },
];

/**
 * 半跑道槽 2D 实体（cut 层，t2/t4 共用同一形状）：
 * 开口直边 y=yc（折合后为箱口对合中线）+ 底边 y=yc+d（靠折线侧）
 * + 左右四分之一圆弧（y-down 数学角，a1>a0：右弧 0→90，左弧 90→180）
 */
function slotEntities(xM: number, yc: number, rw: number, d: number): Entity[] {
  return [
    { kind: 'line', layer: 'cut', a: { x: r3(xM - rw - d), y: r3(yc) }, b: { x: r3(xM + rw + d), y: r3(yc) } },
    { kind: 'arc', layer: 'cut', c: { x: r3(xM + rw), y: r3(yc) }, r: r3(d), a0: 0, a1: 90 },
    { kind: 'line', layer: 'cut', a: { x: r3(xM + rw), y: r3(yc + d) }, b: { x: r3(xM - rw), y: r3(yc + d) } },
    { kind: 'arc', layer: 'cut', c: { x: r3(xM - rw), y: r3(yc) }, r: r3(d), a0: 90, a1: 180 },
  ];
}

/** 面板树中按 id 找节点（摇盖 id 固定为 flap-t2 / flap-t4） */
function findNodes(nodes: PanelNode[], ids: string[]): Map<string, PanelNode> {
  const found = new Map<string, PanelNode>();
  const walk = (ns: PanelNode[]) => {
    for (const n of ns) {
      if (ids.includes(n.id)) found.set(n.id, n);
      walk(n.children);
    }
  };
  walk(nodes);
  return found;
}

export const handleBox = {
  id: 'handle-box',
  name: '瓦楞提手箱',
  category: '瓦楞纸箱',
  fields,
  build(p: BoxParams): DielineResult {
    const make = toMakeSize(p);
    // 孔高 2d；摇盖深 = W/2 + max(修正, d+3)——半槽圆头最深点距折线 W/2+d，留 3mm 边距
    const hh = Math.max(p.handleH, 15);
    const d = hh / 2;
    const gap = Math.max(p.flapGap, d + 3);
    const F = make.w / 2 + gap;

    const { entities, panels, TW, TH } = tubeWithEnds({
      L: make.l,
      W: make.w,
      H: make.h,
      g: p.glueFlap,
      ch: p.chamfer,
      top: { type: 'rockets', F, slot: p.slot },
      bottom: { type: 'rockets', F, slot: p.slot },
    });

    // 孔总长（沿 L 方向）：钳制在摇盖安全范围内（左右边距 ≥ 12mm）
    const autoW = p.handleW > 0 ? p.handleW : Math.min(make.l * 0.55, 90);
    let hw = autoW;
    let rw = Math.max(0, (hw - 2 * d) / 2);

    // 顶部外摇盖：从面板树取 2D 几何（poly[0]/[1] = 折线边两顶点）
    const flaps = findNodes(panels, ['flap-t2', 'flap-t4']);
    const t2 = flaps.get('flap-t2');
    const t4 = flaps.get('flap-t4');
    if (t2 && t4) {
      const y0 = t2.poly[0][1]; // 顶部折线 y（= T）
      const yc = y0 - make.w / 2; // 箱口对合中线
      const xM2 = (t2.poly[0][0] + t2.poly[1][0]) / 2;
      const xM4 = (t4.poly[0][0] + t4.poly[1][0]) / 2;

      const maxW = Math.max(20, (t2.poly[1][0] - t2.poly[0][0]) - 24);
      hw = Math.max(Math.min(autoW, maxW), 2 * d);
      rw = Math.max(0, (hw - 2 * d) / 2);

      entities.push(...slotEntities(xM2, yc, rw, d));
      entities.push(...slotEntities(xM4, yc, rw, d));

      // 3D 孔多边形（6 点近似，含 0.707d 圆弧中点）
      const k = 0.707 * d;
      const hole = (xM: number): [number, number][] =>
        [
          [xM - rw - d, yc],
          [xM - rw - k, yc + k],
          [xM - rw, yc + d],
          [xM + rw, yc + d],
          [xM + rw + k, yc + k],
          [xM + rw + d, yc],
        ].map(([x, y]) => [r3(x), r3(y)]) as [number, number][];
      t2.holes = [...(t2.holes ?? []), hole(xM2)];
      t4.holes = [...(t4.holes ?? []), hole(xM4)];
    }

    const bb = bbox(entities);
    const warnings = [...commonWarnings(p, make)];
    if (p.slot < p.t) warnings.push('开槽缝小于纸厚，摇盖折合时可能干涉');
    if (p.slot === 0) warnings.push('开槽为 0，摇盖共边（部分图式可接受，打样确认）');
    if (F < 10) warnings.push('摇盖深度 < 10mm，封箱强度不足');
    if (p.flapGap < d + 3) warnings.push(`摇盖修正已自动加深至 ${gap.toFixed(0)}mm，保证提手孔完整落在摇盖内`);
    if (make.l <= make.w) warnings.push('L ≤ W：内摇盖折合后覆盖箱口中央，提手孔被封堵，建议 L > W');
    else if (make.l / 2 - (rw + d) < F + 12) warnings.push('提手孔两端距内摇盖 < 12mm，孔部分被内摇盖遮挡');
    if (hw < 60) warnings.push('提手宽 < 60mm，长时间手提舒适度差');
    if (hh < 25) warnings.push('提手高 < 25mm，手指空间偏紧');
    warnings.push('提手孔由对合线两侧半孔拼成，需模切冲孔工艺（孔内废料清废）');

    return {
      entities,
      panels,
      meta: {
        makeSize: make,
        unfold: { w: bb.max.x - bb.min.x, h: bb.max.y - bb.min.y },
        areaM2: (TW * TH) / 1e6,
        flaps: { f1: F, f2: F },
        warnings,
      },
    };
  },
};
