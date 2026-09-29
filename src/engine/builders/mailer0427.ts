/**
 * 管式飞机盒（电商快递盒 mailer，业内编号 0427）
 * 顶部：插舌盖（主盖 + 耳片）；底部：全底板 + 锁舌 + 防尘翼（平压底）。
 * 名称口径：显示名用行业俗称，标准编号不进显示名；id `mailer-0427` 永不改。
 */
import { BoxParams, commonWarnings, toMakeSize, COMMON_FIELDS, FieldSpec } from '../params';
import { bbox, DielineResult } from '../types';
import { tubeWithEnds } from './shared';

const fields: FieldSpec[] = [
  ...COMMON_FIELDS,
  { key: 'tongue', label: '插舌深度', type: 'number', unit: 'mm', min: 4, max: 40, group: '工艺参数' },
];

export const mailer0427 = {
  id: 'mailer-0427',
  name: '管式飞机盒（插舌盖）',
  category: '快递 / 电商',
  sample: { sizeType: 'inner' as const, L: 400, W: 300, H: 100, material: 'B', t: 3 },
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
      bottom: { type: 'fullBase' },
    });

    const bb = bbox(entities);
    const warnings = [...commonWarnings(p, make)];
    if (p.tongue < 8) warnings.push('插舌深度 < 8mm，封口易松脱');
    if (make.h < 25) warnings.push('盒高偏小，底部结构可能过挤，建议打样确认');

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
