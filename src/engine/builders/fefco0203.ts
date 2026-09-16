/**
 * FEFCO 0203 全叠盖箱（Full Overlap Container, FOL）
 * 外摇盖（L 面）深 = 满宽 W：内摇盖先折，两外摇盖先后全幅叠上，
 * 箱顶四层纸板，承压/堆码最强，常用于重型/贵重内容物。
 */
import { BoxParams, commonWarnings, toMakeSize, COMMON_FIELDS, FieldSpec } from '../params';
import { bbox, DielineResult } from '../types';
import { tubeWithEnds } from './shared';

const fields: FieldSpec[] = [
  ...COMMON_FIELDS,
  { key: 'slot', label: '摇盖开槽', type: 'number', unit: 'mm', min: 0, max: 40, group: '工艺参数' },
  { key: 'flapGap', label: '外摇盖修正', type: 'number', unit: 'mm', min: 0, max: 60, group: '工艺参数' },
];

export const fefco0203 = {
  id: 'fefco-0203',
  name: '0203 全叠盖箱',
  category: '瓦楞纸箱',
  fields,
  build(p: BoxParams): DielineResult {
    const make = toMakeSize(p);
    const Fin = make.w / 2; // 内摇盖
    const Fout = make.w + p.flapGap; // 外摇盖满宽（+ 修正余量）

    const { entities, panels, TW, TH } = tubeWithEnds({
      L: make.l,
      W: make.w,
      H: make.h,
      g: p.glueFlap,
      ch: p.chamfer,
      // degStep 稍大：满叠盖 4 层错层更明显，避免 3D 共面
      top: { type: 'rockets', F: Fin, Fout, slot: p.slot, degStep: 1.6 },
      bottom: { type: 'rockets', F: Fin, Fout, slot: p.slot, degStep: 1.6 },
    });

    const bb = bbox(entities);
    const warnings = [...commonWarnings(p, make)];
    if (p.slot < p.t) warnings.push('开槽缝小于纸厚，摇盖折合时可能干涉');
    warnings.push('箱顶为四层纸板全叠结构，用料与压线数量高于 0201，成本相应增加');
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
