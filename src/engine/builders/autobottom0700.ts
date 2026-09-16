/**
 * FEFCO 0700 自锁底盒（crash-lock bottom）
 * 顶部：插舌盖；底部：互锁结构（半深底板 + 带斜压痕的锁板）。
 * 注：自锁底为简化几何（正式刀模以打样为准）。
 */
import { BoxParams, commonWarnings, toMakeSize, COMMON_FIELDS, FieldSpec } from '../params';
import { bbox, DielineResult } from '../types';
import { tubeWithEnds } from './shared';

const fields: FieldSpec[] = [
  ...COMMON_FIELDS,
  { key: 'tongue', label: '插舌深度', type: 'number', unit: 'mm', min: 4, max: 40, group: '工艺参数' },
];

export const autobottom0700 = {
  id: 'autobottom-0700',
  name: '自锁底盒（0700）',
  category: '折叠纸盒',
  fields,
  build(p: BoxParams): DielineResult {
    const make = toMakeSize(p);

    const { entities, panels, TW, TH } = tubeWithEnds({
      L: make.l,
      W: make.w,
      H: make.h,
      g: p.glueFlap,
      ch: p.chamfer,
      top: { type: 'tuck', tongue: p.tongue },
      bottom: { type: 'lockBottom' },
    });

    const bb = bbox(entities);
    const warnings = [...commonWarnings(p, make)];
    if (p.tongue < 8) warnings.push('插舌深度 < 8mm，封口易松脱');
    if (make.w < 40) warnings.push('盒宽 < 40mm，自锁底结构过小，建议打样确认');
    warnings.push('自锁底为简化几何，批量生产前请以实物打样验证');

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
