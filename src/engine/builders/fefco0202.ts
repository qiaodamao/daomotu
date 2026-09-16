/**
 * FEFCO 0202 重叠摇盖箱（Overlap Flap Container, OVF）
 * 与 0201 的区别：外摇盖（L 面）深 = W/2 + 加长量，两外摇盖在箱顶中央重叠，
 * 封箱强度更高（胶带下有双层纸板支撑）。内摇盖仍 W/2。
 */
import { BoxParams, commonWarnings, toMakeSize, COMMON_FIELDS, FieldSpec } from '../params';
import { bbox, DielineResult } from '../types';
import { tubeWithEnds } from './shared';

const fields: FieldSpec[] = [
  ...COMMON_FIELDS,
  { key: 'slot', label: '摇盖开槽', type: 'number', unit: 'mm', min: 0, max: 40, group: '工艺参数' },
  { key: 'flapGap', label: '外摇盖加长', type: 'number', unit: 'mm', min: 0, max: 200, group: '工艺参数' },
];

export const fefco0202 = {
  id: 'fefco-0202',
  name: '0202 重叠摇盖箱',
  category: '瓦楞纸箱',
  fields,
  build(p: BoxParams): DielineResult {
    const make = toMakeSize(p);
    const Fin = make.w / 2; // 内摇盖（W 面）
    const Fout = make.w / 2 + p.flapGap; // 外摇盖（L 面）加长重叠

    const { entities, panels, TW, TH } = tubeWithEnds({
      L: make.l,
      W: make.w,
      H: make.h,
      g: p.glueFlap,
      ch: p.chamfer,
      top: { type: 'rockets', F: Fin, Fout, slot: p.slot },
      bottom: { type: 'rockets', F: Fin, Fout, slot: p.slot },
    });

    const bb = bbox(entities);
    const warnings = [...commonWarnings(p, make)];
    if (p.slot < p.t) warnings.push('开槽缝小于纸厚，摇盖折合时可能干涉');
    if (p.flapGap < 10) warnings.push('外摇盖加长 < 10mm，重叠量过小，结构趋同 0201');
    if (Fout >= make.w) warnings.push('外摇盖 ≥ 盒宽，两外摇盖将完全重叠（请改用全叠盖 0203）');
    if (Fin < 10) warnings.push('摇盖深度 < 10mm，封箱强度不足');

    return {
      entities,
      panels,
      meta: {
        makeSize: make,
        unfold: { w: bb.max.x - bb.min.x, h: bb.max.y - bb.min.y },
        areaM2: (TW * TH) / 1e6,
        flaps: { f1: Fin, f2: Fout },
        warnings,
      },
    };
  },
};
