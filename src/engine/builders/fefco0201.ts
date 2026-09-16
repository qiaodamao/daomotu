/**
 * FEFCO 0201 开槽箱（RSC 常规瓦楞箱）
 * 上下各 4 片摇盖（深 W'/2 + 修正值），摇盖间开槽缝，糊口斜切。
 */
import { BoxParams, commonWarnings, toMakeSize, COMMON_FIELDS, FieldSpec } from '../params';
import { bbox, DielineResult } from '../types';
import { tubeWithEnds } from './shared';

const fields: FieldSpec[] = [
  ...COMMON_FIELDS,
  { key: 'slot', label: '摇盖开槽', type: 'number', unit: 'mm', min: 0, max: 40, group: '工艺参数' },
  { key: 'flapGap', label: '摇盖修正', type: 'number', unit: 'mm', min: 0, max: 60, group: '工艺参数' },
];

export const fefco0201 = {
  id: 'fefco-0201',
  name: '0201 开槽箱',
  category: '瓦楞纸箱',
  fields,
  build(p: BoxParams): DielineResult {
    const make = toMakeSize(p);
    // 摇盖深 = 制造宽 / 2（对折正好盖满箱口）+ 修正余量
    const F = make.w / 2 + p.flapGap;

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
    if (p.slot === 0) warnings.push('开槽为 0，摇盖共边（部分图式可接受，打样确认）');
    if (F < 10) warnings.push('摇盖深度 < 10mm，封箱强度不足');

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
