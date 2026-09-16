/**
 * 抽屉盒（滑盖套筒 + 内托，滑入式书型包装）
 * 两部件组合（同天地盖布局思路）：
 *   内托：管式 + 全底板结构，顶部开口（内容物承载）
 *   套筒：管式四面开口筒，套住内托外壁滑动抽出
 * 套筒制造尺寸 = 内托制造尺寸 + 3t + 间隙（与天地盖盖体推导一致）。
 */
import { BoxParams, commonWarnings, toMakeSize, COMMON_FIELDS, FieldSpec } from '../params';
import { bbox, DielineResult } from '../types';
import { tubeWithEnds, translateEntities, translatePanels } from './shared';

const fields: FieldSpec[] = [
  ...COMMON_FIELDS,
  { key: 'lidH', label: '套筒高', type: 'number', unit: 'mm', min: 10, max: 500, group: '工艺参数' },
  { key: 'clearance', label: '套筒滑动间隙', type: 'number', unit: 'mm', min: 0, max: 5, step: 0.1, group: '工艺参数' },
];

export const drawerBox = {
  id: 'drawer-box',
  name: '抽屉盒（内托 + 套筒）',
  category: '礼盒 / 折叠纸盒',
  fields,
  build(p: BoxParams): DielineResult {
    const t = p.t;
    const base = toMakeSize(p);
    // 套筒制造 = 内托制造 + 3t + 间隙（套筒内壁包住内托外壁）
    const sleL = base.l + 3 * t + p.clearance;
    const sleW = base.w + 3 * t + p.clearance;
    const sleH = Math.max(p.lidH, 10);
    const gap = 10; // 两部件展开图间距

    // 内托：底部全底板（承载结构），顶部开口
    const tray = tubeWithEnds({
      L: base.l, W: base.w, H: base.h,
      g: p.glueFlap, ch: p.chamfer,
      top: { type: 'none' },
      bottom: { type: 'fullBase' },
    });
    // 套筒：两端开口的四面筒
    const sleeve = tubeWithEnds({
      L: sleL, W: sleW, H: sleH,
      g: p.glueFlap, ch: Math.min(p.chamfer, sleH / 2),
      top: { type: 'none' },
      bottom: { type: 'none' },
    });

    const entities = [...tray.entities, ...translateEntities(sleeve.entities, tray.TW + gap, 0)];
    // 3D：内托与套筒两棵树并排（成型后各自折叠，套筒为开口筒）
    const panels = [...tray.panels, ...translatePanels(sleeve.panels, tray.TW + gap, 0)];
    const bb = bbox(entities);

    const warnings = [...commonWarnings(p, base)];
    if (p.clearance < 0.5) warnings.push('滑动间隙 < 0.5mm，抽插可能过紧（瓦楞表面摩擦大）');
    if (sleH < base.h) warnings.push(`套筒高 ${sleH.toFixed(0)}mm < 内托高，为部分包裹样式（常见）`);
    if (sleH < 20) warnings.push('套筒高 < 20mm，内托易滑脱，建议加深或加磁吸/插扣');
    if (sleH > base.h + 2 * t + 5) warnings.push('套筒高超过内托全高，闭合后有空腔');

    return {
      entities,
      panels,
      meta: {
        makeSize: base,
        unfold: { w: bb.max.x - bb.min.x, h: bb.max.y - bb.min.y },
        areaM2: (tray.TW * tray.TH + sleeve.TW * sleeve.TH) / 1e6,
        warnings,
      },
    };
  },
};
