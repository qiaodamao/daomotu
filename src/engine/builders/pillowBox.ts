/**
 * 枕形盒（Pillow Box，礼品/糖果袜类）
 * 一片卡纸成型、无糊口：上板 H + 底棱条（枕厚）+ 下板 H 三横排，
 * 两端各上下两片鱼形弧翼（多段折线近似弧线），折入后互相叠住锁合端部（摩擦自锁）。
 *
 * 折合顺序（3D 波次）：棱条立起(0.02) → 上板盖上(0.40) → 两端翼折入(0.74)；
 * 上翼 hinge sign 与"向上立折"方向相反（引擎 v 折 rotation.z=-rad·sign，
 * sign 取几何位置的反侧即向下折入盒内，不穿地）。
 * 成型姿态：长 L 沿 x、枕厚 W 竖直、枕高 H 沿 z，平躺贴地。
 */
import { BoxParams, toMakeSize, COMMON_FIELDS, FieldSpec } from '../params';
import { bbox, DielineResult, PanelNode, r3 } from '../types';
import { EntCollector } from './shared';

const fields: FieldSpec[] = [
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
  { key: 'L', label: '枕长 L', type: 'number', unit: 'mm', min: 30, max: 600, group: '尺寸' },
  { key: 'W', label: '枕厚 W', type: 'number', unit: 'mm', min: 8, max: 400, group: '尺寸' },
  { key: 'H', label: '枕高 H', type: 'number', unit: 'mm', min: 20, max: 600, group: '尺寸' },
  ...COMMON_FIELDS.filter((f) => f.key === 'material' || f.key === 't'),
];

/** 鱼形弧翼轮廓（多段折线近似弧，2D 实体与 3D 面板同源）：
 *  根边两端 → 翼缘 3 点（最深点在根边中线） */
function wingPoly(edgeX: number, y0: number, y1: number, depth: number, dir: 1 | -1): [number, number][] {
  const H = y1 - y0;
  return [
    [edgeX, y0],
    [edgeX + dir * 0.55 * depth, y0 + 0.08 * H],
    [edgeX + dir * depth, y0 + 0.5 * H],
    [edgeX + dir * 0.55 * depth, y0 + 0.92 * H],
    [edgeX, y1],
  ].map(([x, y]) => [r3(x), r3(y)] as [number, number]);
}

export const pillowBox = {
  id: 'pillow-box',
  name: '枕形盒（Pillow）',
  category: '折叠纸盒（卡纸/彩盒）',
  fields,
  build(p: BoxParams): DielineResult {
    const make = toMakeSize(p);
    const L = make.l;
    const W = make.w; // 枕厚（竖直）
    const H = make.h; // 枕高（上/下板各 H）

    // 翼深：受枕厚限制（上翼向下折 Dw ≤ W 不穿地），同时别太深出格
    const Dw = Math.min(W * 0.96, H * 0.85);

    // 2D 布局（y-down）：上板 [0,H] + 棱条 [H,H+W] + 下板 [H+W,2H+W]，x ∈ [0,L]
    const TH = 2 * H + W;
    const TW = L + 2 * Dw;

    const c = new EntCollector();
    // 主体两条长折线 + 四条翼根折线
    c.line('crease', 0, H, L, H);
    c.line('crease', 0, H + W, L, H + W);
    c.line('crease', 0, 0, 0, H);
    c.line('crease', L, 0, L, H);
    c.line('crease', 0, H + W, 0, TH);
    c.line('crease', L, H + W, L, TH);

    // 外轮廓（闭合回路）：
    // 上边 → 右上翼 → 棱条右缘 → 右下翼 → 下边 → 左下翼 → 棱条左缘 → 左上翼
    c.line('cut', 0, 0, L, 0);
    c.line('cut', L, TH, 0, TH);
    const upR = wingPoly(L, 0, H, Dw, 1);
    const upL = wingPoly(0, 0, H, Dw, -1);
    const dnR = wingPoly(L, H + W, TH, Dw, 1);
    const dnL = wingPoly(0, H + W, TH, Dw, -1);
    for (const w of [upR, dnR, dnL, upL]) c.polyline('cut', w);
    c.line('cut', L, H, L, H + W); // 棱条右缘
    c.line('cut', 0, H, 0, H + W); // 棱条左缘

    // 3D 面板树：根 = 下板（成型后水平贴地）
    const mk = (id: string, poly: [number, number][], hinge: PanelNode['hinge'], finalDeg?: number, phase?: number): PanelNode => ({
      id,
      poly,
      hinge,
      finalDeg,
      phase,
      children: [],
    });
    const rect = (x0: number, y0: number, x1: number, y1: number): [number, number][] => [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ];

    // 棱条：h 折 sign+1（折线上方）90° 立起
    const spine = mk('spine', rect(0, H, L, H + W), { kind: 'h', at: H + W, sign: 1 }, 90, 0.02);
    // 上板：挂棱条，h 折 90°（手风琴第二级）盖上成水平
    const upper = mk('upper', rect(0, 0, L, H), { kind: 'h', at: H, sign: 1 }, 90, 0.4);
    // 上翼：挂上板，v 折 sign 用正常几何值（左 +1 / 右 -1）——
    // 父链棱条+上板两级 Rx(-90) 复合 Rx(-180)，把局部"向上立"翻转为世界系"向下折入盒内"；
    // 89.4° 与下翼 90.6° 错层避免端面共面 z-fighting
    const upWingL = mk('up-wing-l', upL, { kind: 'v', at: 0, sign: 1 }, 89.4, 0.74);
    const upWingR = mk('up-wing-r', upR, { kind: 'v', at: L, sign: -1 }, 89.4, 0.74);
    // 下翼：挂下板，v 折正常方向（左 +1 / 右 -1）向上立起；90.6° 多折错层
    const dnWingL = mk('dn-wing-l', dnL, { kind: 'v', at: 0, sign: 1 }, 90.6, 0.74);
    const dnWingR = mk('dn-wing-r', dnR, { kind: 'v', at: L, sign: -1 }, 90.6, 0.74);

    spine.children.push(upper);
    upper.children.push(upWingL, upWingR);
    const lower: PanelNode = {
      id: 'lower',
      poly: rect(0, H + W, L, TH),
      children: [spine, dnWingL, dnWingR],
    };
    const panels = [lower];

    const bb = bbox(c.entities);
    const warnings: string[] = [];
    if (p.t < 0.2 || p.t > 10) warnings.push('纸厚超出常规范围 0.2~10mm');
    if (W < 12) warnings.push('枕厚 < 12mm，两端翼难叠住，建议加厚');
    if (Dw <= W / 2) warnings.push('枕高偏小导致翼深不足（≤ 厚度一半），端部锁不住，建议加大枕高');
    if (L < 60) warnings.push('枕长过短，外形比例不协调');

    return {
      entities: c.entities,
      panels,
      meta: {
        makeSize: { l: L, w: W, h: H },
        unfold: { w: bb.max.x - bb.min.x, h: bb.max.y - bb.min.y },
        areaM2: (TW * TH) / 1e6,
        warnings,
      },
    };
  },
};
