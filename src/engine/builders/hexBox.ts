/**
 * 六角柱礼盒（Hexagonal Box，月饼/糖果/茶叶罐式）
 *
 * 结构：正六边形底板 + 六面板围筒链（相邻面板 v 折 60°，六角二面角 120°）
 *   + 糊口粘合封筒 + 顶盖六角板（挂 p3 顶边 h 折 90° 封口）
 *
 * 换根：底板为根（成型后水平贴地，筒口朝上），p3 挂底板下平边立起，
 *   两侧面板 v 折 60° 逐级围拢，盖最后折合封顶。
 *
 * 参数：L = 六角对边宽（尖距 2L/√3）、H = 筒高；W 不适用（已隐藏）
 * 成型姿态：x = 尖距 2a、y = 筒高 H、z = 对边宽 L
 * 折叠波次：p3 立起 0.02 → p2/p4 0.14 → p1/p5 0.26 → p6 0.38 → 糊口 0.50 → 盖 0.62
 */
import { BoxParams, commonWarnings, toMakeSize, COMMON_FIELDS, FieldSpec } from '../params';
import { bbox, DielineResult, PanelNode, r3 } from '../types';
import { EntCollector } from './shared';

const fields: FieldSpec[] = [
  ...COMMON_FIELDS.filter((f) => f.key !== 'W' && f.key !== 'chamfer'),
];

/** 正六边形顶点（平边朝上下，挂边=下平边中段）：返回 [x, y] 列表 */
function hexPts(cx: number, cy: number, a: number): [number, number][] {
  const h = (a * Math.sqrt(3)) / 2; // 对边半距
  return [
    [cx + a / 2, cy + h], [cx - a / 2, cy + h], // 下平边（挂边）
    [cx - a, cy], [cx - a / 2, cy - h],
    [cx + a / 2, cy - h], [cx + a, cy], // 顶点
  ];
}

export const hexBox = {
  id: 'hex-box',
  name: '六角柱礼盒（六边形筒）',
  category: '礼盒 / 组合结构',
  fields,
  build(p: BoxParams): DielineResult {
    const make = toMakeSize(p);
    const L = make.l; // 六角对边宽
    const H = make.h; // 筒高
    const g = Math.min(p.glueFlap || 25, 60); // 糊口宽

    const a = L / Math.sqrt(3); // 六角边长
    const yB = L / 2; // 底板下平边 y（= 对边半距）
    const yT = yB + H; // 筒身上缘

    // ---- 面板 poly ----
    // 六面板横排（x 从左到右：p1 p2 p3 p4 p5 p6，各宽 a，y ∈ [yB, yT]）
    const px = (i: number): [number, number][] => {
      const x0 = (i - 3.5) * a; // p1 左缘（i=1 → x0=-2.5a）
      return [
        [x0, yB], [x0 + a, yB], [x0 + a, yT], [x0, yT],
      ];
    };
    const hexBase = hexPts(0, 0, a); // 底板（中心原点）
    const hexCover = hexPts(0, yT + L / 2, a); // 顶盖（挂 p3 顶边，中心 yT + L/2）
    const glue: [number, number][] = [
      [3.5 * a, yB + 10], [3.5 * a + g, yB + 10 + g], [3.5 * a + g, yT - 10 - g],
      [3.5 * a, yT - 10], // 糊口（挂 p6 右缘，上下 45° 斜切）
    ];

    // ---- 面板树（换根：底板为根，贴地不动）----
    const panel = (id: string, poly: [number, number][], at: number, sign: 1 | -1, phase: number, children: PanelNode[] = []): PanelNode => ({
      id, poly, hinge: { kind: 'v', at, sign }, finalDeg: 60, phase, children,
    });
    // 糊口挂 p6 右缘（末级）
    const glueNode: PanelNode = { id: 'glue', poly: glue, hinge: { kind: 'v', at: 3.5 * a, sign: -1 }, finalDeg: 60, phase: 0.50, children: [] };
    // p6 挂 p5 右缘
    const p6 = panel('p6', px(6), 2.5 * a, -1, 0.38, [glueNode]);
    const p5 = panel('p5', px(5), 1.5 * a, -1, 0.26, [p6]);
    const p4 = panel('p4', px(4), 0.5 * a, -1, 0.14, [p5]);
    const p2 = panel('p2', px(2), -0.5 * a, 1, 0.14, [
      panel('p1', px(1), -1.5 * a, 1, 0.26),
    ]);
    const p3: PanelNode = {
      id: 'p3', poly: px(3),
      hinge: { kind: 'h', at: yB, sign: -1 }, finalDeg: 90, phase: 0.02,
      children: [
        p2, p4,
        // 顶盖：挂 p3 顶边，折 90° 转水平封住筒口
        {
          id: 'cover', poly: hexCover,
          hinge: { kind: 'h', at: yT, sign: -1 }, finalDeg: 90, phase: 0.62,
          children: [],
        },
      ],
    };
    const base: PanelNode = { id: 'base', poly: hexBase, children: [p3] };

    // ---- 2D 实体 ----
    const c = new EntCollector();
    // 底板六角轮廓（cut，除挂边下平边外 5 边）
    c.polyline('cut', hexBase.slice(1), false); // (−a/2,L/2) 起 → 顶点 → 回 (a/2,L/2)
    // 顶盖六角轮廓（cut，除挂边外 5 边）
    c.polyline('cut', hexCover.slice(1), false);
    // 链外框（cut）：上/下长缘（p3 段为 crease 分开画）+ 左右端
    c.line('cut', -2.5 * a, yB, -0.5 * a, yB); // 下缘左段（p1+p2）
    c.line('cut', 0.5 * a, yB, 2.5 * a, yB); // 下缘右段（p4-p6）
    c.line('cut', -2.5 * a, yT, -0.5 * a, yT); // 上缘左段
    c.line('cut', 0.5 * a, yT, 2.5 * a, yT); // 上缘右段
    c.line('cut', -2.5 * a, yB, -2.5 * a, yT); // p1 左缘
    // p6 右缘（cut，被糊口斜切分段）：上/下各 10 直段
    c.line('cut', 3.5 * a, yB, 3.5 * a, yB + 10);
    c.line('cut', 3.5 * a, yT - 10, 3.5 * a, yT);
    // 糊口轮廓（cut：斜边 + 右缘）
    c.polyline('cut', glue, true);
    // 铰线（crease）
    for (let i = 1; i <= 5; i++) c.line('crease', (i - 3) * a, yB, (i - 3) * a, yT); // p_i | p_{i+1} 分界（x = -1.5a,-0.5a,0.5a,1.5a,2.5a）
    c.line('crease', -0.5 * a, yB, 0.5 * a, yB); // 底板挂边（p3 底）
    c.line('crease', -0.5 * a, yT, 0.5 * a, yT); // 盖挂边（p3 顶）

    const bb = bbox(c.entities);
    const warnings = [...commonWarnings(p, make)].filter((w) => !w.includes('斜切'));
    warnings.push('六面围筒压线夹角 120°（v 折 60°），糊口需上机粘合或手工白胶');
    if (L < 60) warnings.push('六角对边宽 < 60mm，围筒面板过窄，成型困难');
    if (H > 3 * L) warnings.push('筒高超过对边宽 3 倍，细高筒易歪斜，建议加内衬');

    return {
      entities: c.entities,
      panels: [base],
      meta: {
        makeSize: make,
        unfold: { w: bb.max.x - bb.min.x, h: bb.max.y - bb.min.y },
        areaM2: (2 * ((3 * Math.sqrt(3)) / 2) * a * a + 6 * a * H + g * (H - 20)) / 1e6,
        warnings,
      },
    };
  },
};
