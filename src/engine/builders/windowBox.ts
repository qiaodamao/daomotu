/**
 * 开窗摇盖箱（0201 结构 + 正面展示窗）
 * 0201 管式摇盖箱，正面（col2，L 面）中央开矩形窗（四角圆角），
 * 用于零售展示 / 电商“看得见内容物”包装。窗内贴 PVC/PET 透明片。
 */
import { BoxParams, commonWarnings, toMakeSize, COMMON_FIELDS, FieldSpec } from '../params';
import { bbox, DielineResult, Entity, PanelNode, r3 } from '../types';
import { tubeWithEnds } from './shared';

const fields: FieldSpec[] = [
  ...COMMON_FIELDS,
  { key: 'slot', label: '摇盖开槽', type: 'number', unit: 'mm', min: 0, max: 40, group: '工艺参数' },
  { key: 'flapGap', label: '摇盖修正', type: 'number', unit: 'mm', min: 0, max: 60, group: '工艺参数' },
  { key: 'winW', label: '窗宽（0=自动）', type: 'number', unit: 'mm', min: 0, max: 1900, group: '开窗' },
  { key: 'winH', label: '窗高（0=自动）', type: 'number', unit: 'mm', min: 0, max: 1900, group: '开窗' },
];

/** 圆角矩形开窗实体（4 直边 + 4 角弧，全部 cut 层） */
function windowEntities(wx0: number, wy0: number, wx1: number, wy1: number, R: number): Entity[] {
  const ents: Entity[] = [];
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    ents.push({ kind: 'line', layer: 'cut', a: { x: r3(x1), y: r3(y1) }, b: { x: r3(x2), y: r3(y2) } });
  const arc = (cx: number, cy: number, a0: number, a1: number) =>
    ents.push({ kind: 'arc', layer: 'cut', c: { x: r3(cx), y: r3(cy) }, r: r3(R), a0, a1 });

  // 直边（避开圆角段）
  line(wx0 + R, wy0, wx1 - R, wy0); // 上
  line(wx1, wy0 + R, wx1, wy1 - R); // 右
  line(wx1 - R, wy1, wx0 + R, wy1); // 下
  line(wx0, wy1 - R, wx0, wy0 + R); // 左
  // 四角弧（数学角，y-down 数据；左上 180→270，右上 270→360，右下 0→90，左下 90→180）
  arc(wx0 + R, wy0 + R, 180, 270);
  arc(wx1 - R, wy0 + R, 270, 360);
  arc(wx1 - R, wy1 - R, 0, 90);
  arc(wx0 + R, wy1 - R, 90, 180);
  return ents;
}

/** 在面板树中给 col2（正面）节点加开窗孔 */
function addWindowHole(trees: PanelNode[], hole: [number, number][]): boolean {
  for (const n of trees) {
    if (n.id === 'col2') {
      n.holes = [...(n.holes ?? []), hole];
      return true;
    }
    if (addWindowHole(n.children, hole)) return true;
  }
  return false;
}

export const windowBox = {
  id: 'window-box',
  name: '开窗摇盖箱（正面展示窗）',
  category: '瓦楞纸箱',
  fields,
  build(p: BoxParams): DielineResult {
    const make = toMakeSize(p);
    const F = make.w / 2 + p.flapGap;

    const { entities, panels, TW, TH } = tubeWithEnds({
      L: make.l,
      W: make.w,
      H: make.h,
      g: p.glueFlap,
      ch: p.chamfer,
      top: { type: 'rockets', F, slot: p.slot },
      bottom: { type: 'rockets', F, slot: p.slot },
    });

    // 窗几何：正面 col2 中央（x ∈ [g+W, g+W+L]，y ∈ [T, T+H]，T = F 摇盖深）
    const xs2 = p.glueFlap + make.w;
    const T = F;
    const MARGIN = 15; // 窗边到折线的最小安全边距
    const autoW = p.winW > 0 ? p.winW : Math.round(make.l * 0.6);
    const autoH = p.winH > 0 ? p.winH : Math.round(make.h * 0.6);
    const winW = Math.min(autoW, Math.max(10, make.l - 2 * MARGIN));
    const winH = Math.min(autoH, Math.max(10, make.h - 2 * MARGIN));
    const R = Math.max(0, Math.min(6, winW / 4, winH / 4)); // 窗角半径
    const wx0 = xs2 + (make.l - winW) / 2;
    const wy0 = T + (make.h - winH) / 2;

    entities.push(...windowEntities(wx0, wy0, wx0 + winW, wy0 + winH, R));
    // 3D 开窗（方矩形孔，方向与外轮廓相反）
    addWindowHole(panels, [
      [wx0, wy0],
      [wx0, wy0 + winH],
      [wx0 + winW, wy0 + winH],
      [wx0 + winW, wy0],
    ]);

    const bb = bbox(entities);
    const warnings = [...commonWarnings(p, make)];
    if (p.slot < p.t) warnings.push('开槽缝小于纸厚，摇盖折合时可能干涉');
    warnings.push('开窗处需贴透明片（PVC/PET）或复合透明膜，请安排印后工序');
    if (autoW > make.l - 2 * MARGIN || autoH > make.h - 2 * MARGIN)
      warnings.push('窗尺寸超出安全边距，已自动收窄（建议窗边距 ≥ 15mm）');
    if (winW < 30 || winH < 30) warnings.push('窗 < 30mm，展示效果有限且贴膜困难');

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
