/**
 * 平压底飞机盒（国内快递常用款）
 * 顶部：插舌盖（主盖 + 耳片）；底部：平压底——前后两大片对折互叠 + 两侧浅防尘翼，
 * 成型后底面平整，底部侧缝用胶带封合（对比 0427 的全底板锁舌底）。
 */
import { BoxParams, commonWarnings, toMakeSize, COMMON_FIELDS, FieldSpec } from '../params';
import { bbox, DielineResult } from '../types';
import { tubeWithEnds } from './shared';

const fields: FieldSpec[] = [
  ...COMMON_FIELDS,
  { key: 'tongue', label: '插舌深度', type: 'number', unit: 'mm', min: 4, max: 40, group: '工艺参数' },
];

export const mailerFlat = {
  id: 'mailer-flat',
  name: '平压底飞机盒（胶带封底）',
  category: '快递 / 电商',
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
      bottom: { type: 'flatCrush' },
    });

    const bb = bbox(entities);
    const warnings = [...commonWarnings(p, make)];
    if (p.tongue < 8) warnings.push('插舌深度 < 8mm，封口易松脱');
    if (make.w < 40) warnings.push('盒宽偏小，平压底两大片叠压区不足，建议 ≥ 40mm');
    warnings.push('平压底需胶带封底缝');

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
