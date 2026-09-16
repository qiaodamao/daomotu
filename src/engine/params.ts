/**
 * 参数体系：尺寸类型（内/制造/外）换算 + 瓦楞材质库 + 参数面板字段声明
 */

/** 瓦楞材质库（厚度 mm）——对齐主流工具默认值 */
export const MATERIALS: { id: string; name: string; t: number }[] = [
  { id: 'E', name: 'E楞 · 3层 · 微型 · 2mm', t: 2 },
  { id: 'B', name: 'B楞 · 3层 · 常规 · 3mm', t: 3 },
  { id: 'C', name: 'C楞 · 3层 · 中型 · 3.5mm', t: 3.5 },
  { id: 'A', name: 'A楞 · 3层 · 大型 · 5mm', t: 5 },
  { id: 'EB', name: 'EB楞 · 5层 · 双瓦 · 5mm', t: 5 },
  { id: 'BC', name: 'BC楞 · 5层 · 双瓦 · 6mm', t: 6 },
  { id: 'AB', name: 'AB楞 · 5层 · 双瓦 · 8mm', t: 8 },
  { id: 'custom', name: '自定义厚度', t: 3 },
];

export type SizeType = 'inner' | 'make' | 'outer';

export interface BoxParams {
  sizeType: SizeType;
  /** 长宽高（按 sizeType 解释，单位 mm） */
  L: number;
  W: number;
  H: number;
  material: string;
  /** 纸厚 mm（material=custom 时可编辑，否则跟材质） */
  t: number;
  /** 糊口宽度 */
  glueFlap: number;
  /** 摇盖开槽缝宽（0201） */
  slot: number;
  /** 糊口上下斜切量 */
  chamfer: number;
  /** 摇盖深度修正（0201，默认 0） */
  flapGap: number;
  /** 插舌深度（飞机盒/自锁底盒顶部） */
  tongue: number;
  /** 天地盖：盖高（抽屉盒复用为套筒高） */
  lidH: number;
  /** 天地盖：盖与底的单边间隙（抽屉盒复用为套筒间隙） */
  clearance: number;
  /** 开窗盒：窗宽（0 = 自动，正面宽的 60%） */
  winW: number;
  /** 开窗盒：窗高（0 = 自动，盒高的 60%） */
  winH: number;
  /** 提手盒：提手孔宽（0 = 自动，长的 55%，上限 90） */
  handleW: number;
  /** 提手盒：提手孔高 */
  handleH: number;
}

export const DEFAULT_PARAMS: BoxParams = {
  sizeType: 'make',
  L: 434,
  W: 214,
  H: 278,
  material: 'B',
  t: 3,
  glueFlap: 30,
  slot: 7,
  chamfer: 9,
  flapGap: 0,
  tongue: 12,
  lidH: 60,
  clearance: 0.5,
  winW: 0,
  winH: 0,
  handleW: 0,
  handleH: 30,
};

export interface MakeSize {
  l: number;
  w: number;
  h: number;
}

/**
 * 尺寸换算：输入尺寸 → 制造尺寸
 * 行业近似：长宽方向单层壁（±t），高度方向含顶底材料（±2t）
 */
export function toMakeSize(p: BoxParams): MakeSize {
  const t = p.t;
  if (p.sizeType === 'inner') {
    return { l: p.L + t, w: p.W + t, h: p.H + 2 * t };
  }
  if (p.sizeType === 'outer') {
    return { l: p.L - 2 * t, w: p.W - 2 * t, h: p.H - 2 * t };
  }
  return { l: p.L, w: p.W, h: p.H };
}

/** 由制造尺寸反推内/外尺寸（信息面板展示用） */
export function sizeTable(make: MakeSize, t: number) {
  return {
    make,
    inner: { l: make.l - t, w: make.w - t, h: make.h - 2 * t },
    outer: { l: make.l + 2 * t, w: make.w + 2 * t, h: make.h + 2 * t },
  };
}

/** 通用工艺校验 */
export function commonWarnings(p: BoxParams, make: MakeSize): string[] {
  const w: string[] = [];
  if (make.l < 20 || make.w < 20 || make.h < 20) w.push('尺寸过小（< 20mm），请检查输入');
  if (p.glueFlap < 15) w.push('糊口偏小，粘合箱建议 ≥ 15mm');
  if (p.glueFlap > make.h * 0.6) w.push('糊口过大，可能超过箱高');
  if (p.t < 0.2 || p.t > 10) w.push('纸厚超出常规范围 0.2~10mm');
  return w;
}

/* ---------------- 参数面板字段声明 ---------------- */

export interface FieldSpec {
  key: keyof BoxParams;
  label: string;
  type: 'number' | 'select' | 'segment';
  unit?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  /** 所属分组标题 */
  group: string;
  /** 条件显隐 */
  when?: (p: BoxParams) => boolean;
}

/** 所有盒型共用的基础字段 */
export const COMMON_FIELDS: FieldSpec[] = [
  {
    key: 'sizeType',
    label: '尺寸类型',
    type: 'segment',
    group: '尺寸',
    options: [
      { value: 'inner', label: '内尺寸' },
      { value: 'make', label: '制造尺寸' },
      { value: 'outer', label: '外尺寸' },
    ],
  },
  { key: 'L', label: '长 L', type: 'number', unit: 'mm', min: 10, max: 2000, group: '尺寸' },
  { key: 'W', label: '宽 W', type: 'number', unit: 'mm', min: 10, max: 2000, group: '尺寸' },
  { key: 'H', label: '高 H', type: 'number', unit: 'mm', min: 10, max: 2000, group: '尺寸' },
  {
    key: 'material',
    label: '材质',
    type: 'select',
    group: '材质',
    options: MATERIALS.map((m) => ({ value: m.id, label: m.name })),
  },
  { key: 't', label: '纸厚 t', type: 'number', unit: 'mm', min: 0.2, max: 10, step: 0.1, group: '材质', when: (p) => p.material === 'custom' },
  { key: 'glueFlap', label: '糊口', type: 'number', unit: 'mm', min: 0, max: 200, group: '工艺参数' },
  { key: 'chamfer', label: '糊口斜切', type: 'number', unit: 'mm', min: 0, max: 60, group: '工艺参数' },
];
