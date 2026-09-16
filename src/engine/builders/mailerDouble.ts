/**
 * 双联飞机盒（一版两件拼版）
 * 刀模打样常用：同一展开图横向复制两件 + 拼版间隙，
 * 一刀切两件，提高纸板利用率与打样效率。
 */
import { BoxParams, commonWarnings, toMakeSize, COMMON_FIELDS, FieldSpec } from '../params';
import { bbox, DielineResult } from '../types';
import { tubeWithEnds, translateEntities } from './shared';

const fields: FieldSpec[] = [
  ...COMMON_FIELDS,
  { key: 'tongue', label: '插舌深度', type: 'number', unit: 'mm', min: 4, max: 40, group: '工艺参数' },
];

export const mailerDouble = {
  id: 'mailer-double',
  name: '双联飞机盒（一版两件）',
  category: '快递 / 电商',
  fields,
  build(p: BoxParams): DielineResult {
    const make = toMakeSize(p);
    const gap = 10; // 拼版间隙（共用裁切线可设 0）

    const single = tubeWithEnds({
      L: make.l,
      W: make.w,
      H: make.h,
      g: p.glueFlap,
      ch: p.chamfer,
      top: { type: 'tuck', tongue: p.tongue },
      bottom: { type: 'fullBase' },
    });

    const entities = [
      ...single.entities,
      ...translateEntities(single.entities, single.TW + gap, 0),
    ];
    // 3D 预览单件即可（拼版是 2D 刀模概念）
    const bb = bbox(entities);

    const warnings = [...commonWarnings(p, make)];
    if (p.tongue < 8) warnings.push('插舌深度 < 8mm，封口易松脱');
    warnings.push('双联拼版：展开总宽 ×2，请确认幅面/模切机尺寸适配');

    return {
      entities,
      panels: single.panels,
      meta: {
        makeSize: make,
        unfold: { w: bb.max.x - bb.min.x, h: bb.max.y - bb.min.y },
        areaM2: (single.TW * single.TH * 2) / 1e6,
        warnings,
      },
    };
  },
};
