/**
 * FEFCO 0200 全叠盖开槽箱
 * 与 0201 的区别：摇盖间无开槽缝（slot=0），内外摇盖满宽对折。
 */
import { BoxParams, commonWarnings, toMakeSize, COMMON_FIELDS, FieldSpec } from '../params';
import { bbox, DielineResult } from '../types';
import { tubeWithEnds } from './shared';

const fields: FieldSpec[] = [
  ...COMMON_FIELDS,
  { key: 'flapGap', label: '摇盖修正', type: 'number', unit: 'mm', min: 0, max: 60, group: '工艺参数' },
];

export const fefco0200 = {
  id: 'fefco-0200',
  name: '0200 全叠盖箱',
  category: '瓦楞纸箱',
  fields,
  build(p: BoxParams): DielineResult {
    const make = toMakeSize(p);
    const F = make.w / 2 + p.flapGap;
    const slot = 0; // 0200 特征：无开槽缝

    const { entities, panels, TW, TH } = tubeWithEnds({
      L: make.l,
      W: make.w,
      H: make.h,
      g: p.glueFlap,
      ch: p.chamfer,
      top: { type: 'rockets', F, slot },
      bottom: { type: 'rockets', F, slot },
    });

    const bb = bbox(entities);
    const warnings = [...commonWarnings(p, make)];
    if (F < 10) warnings.push('摇盖深度 < 10mm，封箱强度不足');
    warnings.push('0200 摇盖共边无开槽，切刀在共边线处，请确认工厂工艺');

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
