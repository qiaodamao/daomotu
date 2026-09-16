/**
 * 短摇盖开口箱（short flap open-top）
 * 摇盖深 = W/3（远小于 W/2），四片摇盖不闭合、箱口敞开，
 * 适合作内箱/衬箱/周转箱（配合外箱或收缩膜使用）。
 */
import { BoxParams, commonWarnings, toMakeSize, COMMON_FIELDS, FieldSpec } from '../params';
import { bbox, DielineResult } from '../types';
import { tubeWithEnds } from './shared';

const fields: FieldSpec[] = [
  ...COMMON_FIELDS,
  { key: 'slot', label: '摇盖开槽', type: 'number', unit: 'mm', min: 0, max: 40, group: '工艺参数' },
  { key: 'flapGap', label: '摇盖修正', type: 'number', unit: 'mm', min: 0, max: 60, group: '工艺参数' },
];

export const shortFlapBox = {
  id: 'short-flap-box',
  name: '短摇盖开口箱',
  category: '瓦楞纸箱',
  fields,
  build(p: BoxParams): DielineResult {
    const make = toMakeSize(p);
    const F = make.w / 3 + p.flapGap; // 短摇盖（W/3）

    const { entities, panels, TW, TH } = tubeWithEnds({
      L: make.l,
      W: make.w,
      H: make.h,
      g: p.glueFlap,
      ch: p.chamfer,
      top: { type: 'rockets', F, slot: p.slot },
      bottom: { type: 'rockets', F, slot: p.slot },
    });

    const bb = bbox(entities);
    const warnings = [...commonWarnings(p, make)];
    if (p.slot < p.t) warnings.push('开槽缝小于纸厚，摇盖折合时可能干涉');
    warnings.push('短摇盖不闭合箱口（敞开设计），需配合外箱/盖板/收缩膜使用');
    if (F < 8) warnings.push('摇盖深度 < 8mm，摇盖几乎无功能，请确认尺寸');

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
