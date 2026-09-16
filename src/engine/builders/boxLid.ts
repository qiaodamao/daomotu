/**
 * 天地盖（底盒 + 盖盒）
 * 底盒：全底板结构，顶部开口；盖盒：全顶板结构（上下翻转），底部开口。
 * 盖制造尺寸 = 底制造尺寸 + 3t + 间隙（盖住底的外壁）。
 */
import { BoxParams, commonWarnings, toMakeSize, COMMON_FIELDS, FieldSpec } from '../params';
import { bbox, DielineResult } from '../types';
import { tubeWithEnds, translateEntities, translatePanels } from './shared';

const fields: FieldSpec[] = [
  ...COMMON_FIELDS,
  { key: 'lidH', label: '盖高', type: 'number', unit: 'mm', min: 10, max: 500, group: '工艺参数' },
  { key: 'clearance', label: '盖单边间隙', type: 'number', unit: 'mm', min: 0, max: 5, step: 0.1, group: '工艺参数' },
];

export const boxLid = {
  id: 'box-lid',
  name: '天地盖（盒 + 盖）',
  category: '礼盒 / 折叠纸盒',
  fields,
  build(p: BoxParams): DielineResult {
    const t = p.t;
    const base = toMakeSize(p);
    // 盖内尺寸 = 底外尺寸 + 间隙；盖制造 = 盖内 + t = 底制造 + 3t + 间隙
    const lidL = base.l + 3 * t + p.clearance;
    const lidW = base.w + 3 * t + p.clearance;
    const lidH = Math.max(p.lidH, 10);
    const gap = 10; // 两个部件在展开图上的间距

    // 底盒：底部全底板，顶部开口
    const b = tubeWithEnds({
      L: base.l, W: base.w, H: base.h,
      g: p.glueFlap, ch: p.chamfer,
      top: { type: 'none' },
      bottom: { type: 'fullBase' },
    });
    // 盖盒：顶部全顶板（结构镜像），底部开口
    const l = tubeWithEnds({
      L: lidL, W: lidW, H: lidH,
      g: p.glueFlap, ch: Math.min(p.chamfer, lidH / 2),
      top: { type: 'fullBase' },
      bottom: { type: 'none' },
    });

    const entities = [...b.entities, ...translateEntities(l.entities, b.TW + gap, 0)];
    // 3D：底盒 + 盖盒两棵树（盖平移到右侧，成型后并排）
    const panels = [...b.panels, ...translatePanels(l.panels, b.TW + gap, 0)];
    const bb = bbox(entities);

    const warnings = [...commonWarnings(p, base)];
    if (p.clearance < 0.3) warnings.push('盖间隙 < 0.3mm，装配可能过紧');
    if (lidH < 15) warnings.push('盖高 < 15mm，结构偏弱');

    return {
      entities,
      panels,
      meta: {
        makeSize: base,
        unfold: { w: bb.max.x - bb.min.x, h: bb.max.y - bb.min.y },
        areaM2: (b.TW * b.TH + l.TW * l.TH) / 1e6,
        warnings,
      },
    };
  },
};
