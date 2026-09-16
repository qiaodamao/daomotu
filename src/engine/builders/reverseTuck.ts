/**
 * 反插盒（Reverse Tuck End，RTE）
 * 与直插盒（双插舌）的区别：两端插舌方向相差 90°——
 * 顶部主盖在正面（col2）、底部主盖在背面（col4），
 * 成型后两插舌分别从相对的两侧插入，糊口线与插舌线错开，
 * 是日化/食品彩盒最常用的盒型（印刷面拼版效率高）。
 */
import { BoxParams, commonWarnings, toMakeSize, COMMON_FIELDS, FieldSpec } from '../params';
import { bbox, DielineResult } from '../types';
import { tubeWithEnds } from './shared';

const fields: FieldSpec[] = [
  ...COMMON_FIELDS,
  { key: 'tongue', label: '插舌深度', type: 'number', unit: 'mm', min: 4, max: 40, group: '工艺参数' },
];

export const reverseTuck = {
  id: 'reverse-tuck',
  name: '反插盒（上下反向插舌）',
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
      // 顶部：主盖在正面（col2）；底部：镜像，主盖在背面（col4）→ 插舌方向相差 90°
      top: { type: 'tuck', tongue: p.tongue },
      bottom: { type: 'tuck', tongue: p.tongue, mirror: true },
    });

    const bb = bbox(entities);
    const warnings = [...commonWarnings(p, make)];
    if (p.tongue < 8) warnings.push('插舌深度 < 8mm，封口易松脱');
    if (make.h < 20) warnings.push('盒高偏小，耳片与主盖可能干涉，建议打样确认');
    if (make.l < 40) warnings.push('盒长偏小，插舌收窄后可能过窄，封口不牢');

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
