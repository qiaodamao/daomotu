/**
 * 邮购信封盒（Book Wrap Mailer，书籍/扁平品邮寄）
 *
 * 十字展开（原点=底板中心，y-down）：
 *   底板 L×W + 前后长壁（h 折立起）+ 左右短壁（v 折立起）
 *   + 四角翼（挂短壁端部 h 折 90° 贴长壁内面，包裹角部）
 *   + 盖链挂后壁外缘：顶板（W 跨开口）→ 前搭（S 沿前壁外）→ 舌（插前壁内）
 *   免胶成型：舌插入前壁与内容物之间（或胶带封口），扁平品（书/相册/相框）邮寄标配
 *
 * 成型姿态：L 沿 x、W 沿 y 竖直、壁高 S=H 沿 z，平躺贴地。
 * 折叠波次：壁 0.02 → 角翼 0.30 → 顶板 0.50 → 前搭 0.62 → 舌 0.74
 */
import { BoxParams, commonWarnings, toMakeSize, COMMON_FIELDS, FieldSpec } from '../params';
import { bbox, DielineResult, PanelNode } from '../types';
import { EntCollector } from './shared';

const fields: FieldSpec[] = [
  ...COMMON_FIELDS.filter((f) => f.key !== 'glueFlap' && f.key !== 'chamfer'),
  { key: 'tongue', label: '插舌深', type: 'number', unit: 'mm', min: 8, max: 80, group: '工艺参数' },
];

export const bookWrap = {
  id: 'book-wrap-mailer',
  name: '邮购信封盒（书籍邮寄 Book Wrap）',
  category: '快递 / 电商',
  fields,
  build(p: BoxParams): DielineResult {
    const make = toMakeSize(p);
    const L = make.l;
    const W = make.w;
    const S = make.h; // 壁深 = 成型高
    const T = Math.min(Math.max(p.tongue || 25, 8), 80); // 舌深

    const hw = L / 2; // 底板半长
    const hh = W / 2; // 底板半宽

    // ---- 面板 poly ----
    const basePoly: [number, number][] = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
    const backPoly: [number, number][] = [[-hw, hh], [hw, hh], [hw, hh + S], [-hw, hh + S]]; // 后长壁
    const frontPoly: [number, number][] = [[-hw, -hh], [hw, -hh], [hw, -hh - S], [-hw, -hh - S]]; // 前长壁
    const rightPoly: [number, number][] = [[hw, -hh], [hw + S, -hh], [hw + S, hh], [hw, hh]]; // 右短壁
    const leftPoly: [number, number][] = [[-hw - S, -hh], [-hw, -hh], [-hw, hh], [-hw - S, hh]]; // 左短壁
    // 角翼（挂短壁端部，h 折贴长壁内面）：右短壁背/前侧
    const flapRB: [number, number][] = [[hw, hh], [hw + S, hh], [hw + S, hh + S], [hw, hh + S]];
    const flapRF: [number, number][] = [[hw, -hh], [hw + S, -hh], [hw + S, -hh - S], [hw, -hh - S]];
    // 盖链（挂后壁外缘 y = hh+S）：顶板跨开口 W → 前搭贴前壁外 → 舌插前壁内
    const yC = hh + S; // 后壁外缘 = 顶板铰线
    const yL = yC + W; // 顶板外缘 = 前搭铰线
    const yT = yL + S; // 前搭外缘 = 舌铰线
    const coverPoly: [number, number][] = [[-hw, yC], [hw, yC], [hw, yL], [-hw, yL]];
    const lapPoly: [number, number][] = [[-hw, yL], [hw, yL], [hw, yT], [-hw, yT]];
    const tonguePoly: [number, number][] = [[-hw, yT], [hw, yT], [hw, yT + T], [-hw, yT + T]];

    // ---- 面板树（换根：底板为根，成型后水平）----
    const base: PanelNode = {
      id: 'base', poly: basePoly,
      children: [
        {
          id: 'front', poly: frontPoly,
          hinge: { kind: 'h', at: -hh, sign: 1 }, finalDeg: 90, phase: 0.02,
          children: [],
        },
        {
          id: 'back', poly: backPoly,
          hinge: { kind: 'h', at: hh, sign: -1 }, finalDeg: 90, phase: 0.02,
          children: [
            // 盖链（手风琴式连续折，sign 相同逐级 90°）：
            //   后壁竖 → 顶板水平盖开口 → 前搭竖直贴前壁外 → 舌水平插前壁内
            {
              id: 'cover', poly: coverPoly,
              hinge: { kind: 'h', at: yC, sign: -1 }, finalDeg: 90, phase: 0.50,
              children: [
                {
                  id: 'lap', poly: lapPoly,
                  hinge: { kind: 'h', at: yL, sign: -1 }, finalDeg: 90, phase: 0.62,
                  children: [
                    {
                      id: 'tongue', poly: tonguePoly,
                      hinge: { kind: 'h', at: yT, sign: -1 }, finalDeg: 90, phase: 0.74,
                      children: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: 'right', poly: rightPoly,
          hinge: { kind: 'v', at: hw, sign: -1 }, finalDeg: 90, phase: 0.02,
          children: [
            // 角翼 h 折 90° 折向盒内贴长壁内面；sign 与同侧壁一致
            { id: 'flapRB', poly: flapRB, hinge: { kind: 'h', at: hh, sign: -1 }, finalDeg: 90, phase: 0.30, children: [] },
            { id: 'flapRF', poly: flapRF, hinge: { kind: 'h', at: -hh, sign: 1 }, finalDeg: 90, phase: 0.30, children: [] },
          ],
        },
        {
          id: 'left', poly: leftPoly,
          hinge: { kind: 'v', at: -hw, sign: 1 }, finalDeg: 90, phase: 0.02,
          children: [
            { id: 'flapLB', poly: flapRB.map(([x, y]) => [-x, y] as [number, number]), hinge: { kind: 'h', at: hh, sign: -1 }, finalDeg: 90, phase: 0.30, children: [] },
            { id: 'flapLF', poly: flapRF.map(([x, y]) => [-x, y] as [number, number]), hinge: { kind: 'h', at: -hh, sign: 1 }, finalDeg: 90, phase: 0.30, children: [] },
          ],
        },
      ],
    };

    // ---- 2D 实体 ----
    const c = new EntCollector();
    // 外框（cut，逆时针一笔）：右短壁外缘 → 右下翼 → 前壁外缘 → 左下翼 → 左短壁外缘
    //   → 左上翼 → 盖链左边 → 舌顶 → 盖链右边 → 右上翼 → 闭合
    c.polyline('cut', [
      [hw + S, -hh], [hw + S, -hh - S], [hw, -hh - S],
      [-hw, -hh - S], [-hw - S, -hh - S], [-hw - S, -hh],
      [-hw - S, hh], [-hw - S, hh + S], [-hw, hh + S],
      [-hw, yT + T], [hw, yT + T], [hw, hh + S],
      [hw + S, hh + S], [hw + S, hh],
    ], true);
    // 翼与长壁分界切缝（竖线 ×4）
    c.line('cut', hw, hh, hw, hh + S);
    c.line('cut', hw, -hh, hw, -hh - S);
    c.line('cut', -hw, hh, -hw, hh + S);
    c.line('cut', -hw, -hh, -hw, -hh - S);
    // 铰线（crease）
    c.line('crease', -hw - S, hh, hw + S, hh); // 背侧：后壁 + 两翼铰线共线
    c.line('crease', -hw - S, -hh, hw + S, -hh); // 前侧：前壁 + 两翼铰线共线
    c.line('crease', hw, -hh, hw, hh); // 右短壁
    c.line('crease', -hw, -hh, -hw, hh); // 左短壁
    c.line('crease', -hw, yC, hw, yC); // 顶板铰线
    c.line('crease', -hw, yL, hw, yL); // 前搭铰线
    c.line('crease', -hw, yT, hw, yT); // 舌铰线

    const bb = bbox(c.entities);
    const warnings = [...commonWarnings(p, make)].filter((w) => !w.includes('糊口'));
    warnings.push('免胶结构：插舌插入前壁与内容物之间即自锁，重物邮寄建议外加胶带封口');
    if (S > W) warnings.push('壁深大于开口宽，书籍类扁平品建议 H ≤ W/2（过深浪费材料且插舌难插）');
    if (T < 15) warnings.push('插舌 < 15mm 封口易松，建议 20-30mm');

    return {
      entities: c.entities,
      panels: [base],
      meta: {
        makeSize: make,
        unfold: { w: bb.max.x - bb.min.x, h: bb.max.y - bb.min.y },
        areaM2: ((L + 2 * S) * (2 * S + 2 * W + T)) / 1e6,
        warnings,
      },
    };
  },
};
