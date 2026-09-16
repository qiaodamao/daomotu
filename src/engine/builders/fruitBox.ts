/**
 * 0204 摇盖全底箱（上摇盖 + 全底板）
 * 顶部：摇盖封口（可反复开合）；底部：全底板 + 锁舌 + 防尘翼（一次封箱）。
 * 常用于果蔬箱、洗衣液箱等重载瓦楞箱。
 */
import { BoxParams, commonWarnings, toMakeSize, COMMON_FIELDS, FieldSpec } from '../params';
import { bbox, DielineResult } from '../types';
import { tubeWithEnds } from './shared';

const fields: FieldSpec[] = [
  ...COMMON_FIELDS,
  { key: 'slot', label: '摇盖开槽', type: 'number', unit: 'mm', min: 0, max: 40, group: '工艺参数' },
  { key: 'flapGap', label: '摇盖修正', type: 'number', unit: 'mm', min: 0, max: 60, group: '工艺参数' },
];

export const fruitBox = {
  id: 'fruit-box',
  name: '0204 摇盖全底箱',
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
      bottom: { type: 'fullBase' },
    });

    const bb = bbox(entities);
    const warnings = [...commonWarnings(p, make)];
    if (p.slot < p.t) warnings.push('开槽缝小于纸厚，摇盖折合时可能干涉');
    if (make.h < 40) warnings.push('盒高偏小，全底板折合空间局促，建议打样确认');

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
