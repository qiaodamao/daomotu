/**
 * 卷边托盘（Roll-End Tray）系列：FEFCO 0422 / 0421 / 427
 *
 * 结构（yE = 引擎 y-down，原点=底板中心；成型 L×W×H 平躺，x=L、y=W 竖直、z=H）：
 *   底板八边形（四角斜切）+ 前后墙（h 折立起）+ 角舌（挂墙 v 折 88° 折入端部）
 *   + H4 外侧墙（v 折立起）→ 水平条（v 折 90° 盖沿）→ H3 内侧墙（v 折立起，
 *   双锁舌插底板锁孔）——端部多层瓦楞叠压自锁（角舌先折 phase 0.12、H3 后立
 *   phase 0.50 压住角舌，88° 错层使角舌微斜插入 H3/H4 之间夹层）
 * 盖部：0422 无盖；0421 铰接插舌盖（front 六边形含颈 + 盖 + 插舌）；
 *   427 耳锁盖（盖 + 双耳 + 大舌 + 双弹簧耳，弹簧耳 finalDeg=5° 微翘锁紧）
 *
 * 折叠波次（全显式 phase）：墙 0.02 → 角舌 0.12 → H4 0.24 → 条 0.38
 *   → H3 0.50 → 盖 0.62 → 舌/耳 0.74
 */
import { BoxParams, COMMON_FIELDS, commonWarnings, toMakeSize } from '../params';
import { bbox, DielineResult, Entity, PanelNode, r3 } from '../types';
import { EntCollector } from './shared';

/** 托盘变体规格（偏移量与 PLMPackLib 样例 400×300×100 对齐） */
interface TraySpec {
  lid: 'none' | 'tuck' | 'earlock';
  /** H4 外墙铰线：S = L/2 + off1 */
  off1: (t: number) => number;
  /** 墙铰线：root = W/2 + off3 */
  off3: number;
  /** H4 面板半幅：halfW = W/2 + off4 */
  off4: (t: number) => number;
  /** H4↔条铰线错层宽：X3w = S + H4len + wstrip */
  wstrip: (t: number) => number;
  /** 角舌/H3 铰线修正：T = S - wstrip + tAdj */
  tAdj: number;
  /** 角舌总深修正：D1 = root + d1Adj（0422 样例 D1=root+3；427 JSON D1=root） */
  d1Adj: number;
  /** 角舌通高（427：tongueTop = root + H1） */
  tallTongue?: boolean;
}

const SPEC_0422: TraySpec = {
  lid: 'none',
  off1: (t) => 2 * t + 8,
  off3: 4,
  off4: (t) => 2 * t,
  wstrip: (t) => 2 * t,
  tAdj: 0,
  d1Adj: 3,
};
const SPEC_0421: TraySpec = { ...SPEC_0422, lid: 'tuck' };
const SPEC_427: TraySpec = {
  lid: 'earlock',
  off1: () => 19,
  off3: 7,
  off4: () => 10,
  wstrip: () => 16,
  tAdj: 6,
  d1Adj: 0,
  tallTongue: true,
};

const mirX = (pts: [number, number][]) => pts.map(([x, y]) => [-x, y] as [number, number]);
const mirY = (pts: [number, number][]) => pts.map(([x, y]) => [x, -y] as [number, number]);

export function buildRollTray(p: BoxParams, spec: TraySpec): DielineResult {
  const make = toMakeSize(p);
  const L = make.l;
  const W = make.w;
  const H = make.h;
  const { t } = p;
  // ---- 派生尺寸 ----
  const S = L / 2 + spec.off1(t); // H4 外墙铰线 x
  const root = W / 2 + spec.off3; // 墙铰线 |yE|
  const halfW = W / 2 + spec.off4(t); // H4 面板 yE 半幅
  const ws = spec.wstrip(t);
  const T = S - ws + spec.tAdj; // 角舌铰线 x
  const H1 = H + 4; // 墙高
  const H4len = H + 2; // H4 外墙宽（=高）
  const H3len = H - 2; // H3 内墙宽（=高）
  const D1 = root + spec.d1Adj; // 角舌斜边端 x = T + D1（427 样例 157=root）
  const T1 = spec.lid === 'earlock' ? 8 : 7; // 锁舌凸出深
  const rad15 = Math.PI / 12;
  const T1e = T1 * Math.tan(rad15); // 锁舌 15° 斜收
  const X3w = S + H4len + ws; // 条右铰线 x
  const X3e = X3w + H3len; // H3 右边 x
  const holeC = halfW - 56.5; // 锁孔中心 |yE|
  const hh = 16.5; // 锁孔半高
  const mth = spec.lid === 'earlock' ? 20 : 15; // 锁孔宽
  const H3half = W / 2; // H3 半幅
  const deep = S + H4len <= T + D1; // 深角舌判据（端部足够容纳台阶）
  const tongueTop = spec.tallTongue ? root + H1 : root + H4len - 5;
  const neck = spec.lid === 'tuck' ? 10 : spec.lid === 'earlock' ? 2 : 0; // 墙→盖颈
  const y0 = -(root + H1 + neck); // 盖铰线 yE
  const G = spec.lid === 'tuck' ? S + 2 : T - 10; // 盖半宽 / 耳铰线 x
  const coverD = spec.lid === 'tuck' ? 2 * root : 2 * halfW; // 盖深
  const yt = y0 - coverD; // 舌/大舌铰线 yE

  // ---- 面板 poly（右端定义，左侧 x 镜像；前区 yE<0，后区 y 镜像）----
  const basePoly: [number, number][] = [
    [T, -root], [S, -halfW], [S, halfW], [T, root],
    [-T, root], [-S, halfW], [-S, -halfW], [-T, -root],
  ];
  // 前墙：0422 矩形；0421/427 六边形（含颈外扩到 ±G）
  const frontPoly: [number, number][] =
    spec.lid === 'none'
      ? [[-T, -root], [T, -root], [T, -(root + H1)], [-T, -(root + H1)]]
      : [[-T, -root], [T, -root], [T, -(root + H1)], [G, y0], [-G, y0], [-T, -(root + H1)]];
  const backPoly: [number, number][] = [[-T, root], [T, root], [T, root + H1], [-T, root + H1]];
  // 角舌（前右）：深模式 7 点（台阶 + 斜边），浅模式 5 点（x 封顶 T+D1）
  const tongueF: [number, number][] = deep
    ? [
        [T, -root], [S, -halfW], [S + H4len, -halfW], [S + H4len, -(halfW + 2.55)],
        [T + D1, -(halfW + 15)], [T + D1, -tongueTop], [T, -tongueTop],
      ]
    : [[T, -root], [S, -halfW], [T + D1, -halfW], [T + D1, -tongueTop], [T, -tongueTop]];
  const tongueB = mirY(tongueF);
  // H3 内侧墙（右端，十二点：右边界双锁舌）
  const h3R: [number, number][] = [
    [X3w, -H3half], [X3e, -H3half], [X3e, -(holeC + hh)], [X3e + T1, -(holeC + hh) + T1e],
    [X3e + T1, -(holeC - hh) - T1e], [X3e, -(holeC - hh)], [X3e, holeC - hh],
    [X3e + T1, holeC - hh + T1e], [X3e + T1, holeC + hh - T1e], [X3e, holeC + hh],
    [X3e, H3half], [X3w, H3half],
  ];
  // 条（右，四边形）
  const stripR: [number, number][] = [
    [S + H4len, -halfW], [S + H4len, halfW], [X3w, H3half], [X3w, -H3half],
  ];
  const lockHole = (sx: 1 | -1, sy: 1 | -1): [number, number][] => [
    [sx * (S - mth), sy * (holeC - hh)], [sx * S, sy * (holeC - hh)],
    [sx * S, sy * (holeC + hh)], [sx * (S - mth), sy * (holeC + hh)],
  ];

  // ---- 面板树 ----
  const corner = (id: string, pts: [number, number][], at: number, sign: 1 | -1): PanelNode => ({
    id, poly: pts, hinge: { kind: 'v', at, sign }, finalDeg: 88, phase: 0.12, children: [],
  });
  const front: PanelNode = {
    id: 'front', poly: frontPoly,
    hinge: { kind: 'h', at: -root, sign: 1 }, finalDeg: 90, phase: 0.02,
    children: [
      corner('tongueRF', tongueF, T, -1),
      corner('tongueLF', mirX(tongueF), -T, 1),
    ],
  };
  const back: PanelNode = {
    id: 'back', poly: backPoly,
    hinge: { kind: 'h', at: root, sign: -1 }, finalDeg: 90, phase: 0.02,
    children: [
      corner('tongueRB', tongueB, T, -1),
      corner('tongueLB', mirX(tongueB), -T, 1),
    ],
  };
  const h4R: PanelNode = {
    id: 'h4R',
    poly: [[S, -halfW], [S + H4len, -halfW], [S + H4len, halfW], [S, halfW]],
    hinge: { kind: 'v', at: S, sign: -1 }, finalDeg: 90, phase: 0.24,
    children: [
      {
        id: 'stripR', poly: stripR,
        hinge: { kind: 'v', at: S + H4len, sign: -1 }, finalDeg: 90, phase: 0.38,
        children: [
          { id: 'h3R', poly: h3R, hinge: { kind: 'v', at: X3w, sign: -1 }, finalDeg: 90, phase: 0.50, children: [] },
        ],
      },
    ],
  };
  const h4L: PanelNode = {
    id: 'h4L', poly: mirX(h4R.poly),
    hinge: { kind: 'v', at: -S, sign: 1 }, finalDeg: 90, phase: 0.24,
    children: [
      {
        id: 'stripL', poly: mirX(stripR),
        hinge: { kind: 'v', at: -(S + H4len), sign: 1 }, finalDeg: 90, phase: 0.38,
        children: [
          { id: 'h3L', poly: mirX(h3R), hinge: { kind: 'v', at: -X3w, sign: 1 }, finalDeg: 90, phase: 0.50, children: [] },
        ],
      },
    ],
  };
  const base: PanelNode = {
    id: 'base', poly: basePoly,
    holes: [lockHole(1, 1), lockHole(1, -1), lockHole(-1, 1), lockHole(-1, -1)],
    children: [front, back, h4R, h4L],
  };

  // ---- 盖部 ----
  const c = new EntCollector();
  if (spec.lid === 'tuck') {
    // 0421：盖六边形 + 插舌六点梯形
    const Tw = G - 18;
    front.children.push({
      id: 'cover',
      poly: [[-G, y0], [G, y0], [G, yt + 9], [G - 9, yt], [-(G - 9), yt], [-G, yt + 9]],
      hinge: { kind: 'h', at: y0, sign: 1 }, finalDeg: 90, phase: 0.62,
      children: [
        {
          id: 'tuck',
          poly: [
            [-Tw, yt], [Tw, yt], [Tw, yt - 10], [Tw - 20, yt - 30],
            [-(Tw - 20), yt - 30], [-Tw, yt - 10],
          ],
          hinge: { kind: 'h', at: yt, sign: 1 }, finalDeg: 92, phase: 0.74, children: [],
        },
      ],
    });
  } else if (spec.lid === 'earlock') {
    // 427：盖矩形 + 双耳（六点 + R10）+ 大舌（十三点）+ 双弹簧耳（七点，微翘 5°）
    const TE = T + 4;
    const H7 = 50;
    const earD1 = H7 - 10 + 10 * Math.sin(rad15);
    const earD1t = earD1 * Math.tan(rad15);
    const earD2 = earD1t + 10 * Math.cos(rad15);
    const earR: [number, number][] = [
      [G, y0 - 10], [G + earD1, y0 - 10 - earD1t], [G + H7, y0 - 10 - earD2],
      [G + H7, yt + 10 + earD2], [G + earD1, yt + 10 + earD1t], [G, yt + 10],
    ];
    const bigTongue: [number, number][] = [
      [-G, yt], [G, yt], [G, yt - 4], [TE, yt - 4], [TE, yt - 97], [TE, yt - 100],
      [10, yt - 100], [0, yt - 90], [-10, yt - 100], [-TE, yt - 100], [-TE, yt - 97],
      [-TE, yt - 4], [-G, yt - 4],
    ];
    const springR: [number, number][] = [
      [TE, yt - 4], [TE + 66.65, yt - 28.26], [TE + 78.88, yt - 41.04], [TE + 76.2, yt - 58.53],
      [TE + 70.59, yt - 66.53], [TE + 38.4, yt - 89.1], [TE, yt - 97],
    ];
    front.children.push({
      id: 'cover',
      poly: [[-G, y0], [G, y0], [G, yt], [-G, yt]],
      hinge: { kind: 'h', at: y0, sign: 1 }, finalDeg: 90, phase: 0.62,
      children: [
        { id: 'earR', poly: earR, hinge: { kind: 'v', at: G, sign: -1 }, finalDeg: 90, phase: 0.74, children: [] },
        { id: 'earL', poly: mirX(earR), hinge: { kind: 'v', at: -G, sign: 1 }, finalDeg: 90, phase: 0.74, children: [] },
        {
          id: 'bigTongue', poly: bigTongue,
          hinge: { kind: 'h', at: yt, sign: 1 }, finalDeg: 90, phase: 0.74,
          children: [
            // 弹簧耳挂大舌深链：sign 与常规相反（右 +1 / 左 -1）；
            // 折回 175°（= 180° - 5° 微翘）贴住大舌背面，弹性压紧耳部
            { id: 'springR', poly: springR, hinge: { kind: 'v', at: TE, sign: 1 }, finalDeg: 175, phase: 0.74, children: [] },
            { id: 'springL', poly: mirX(springR), hinge: { kind: 'v', at: -TE, sign: -1 }, finalDeg: 175, phase: 0.74, children: [] },
          ],
        },
      ],
    });
  }

  // ==== PART2：2D 实体绘制 + meta ====
  const arcCut = (cx: number, cy: number, r: number, a0: number, a1: number) =>
    c.entities.push({
      kind: 'arc',
      layer: 'cut',
      c: { x: r3(cx), y: r3(cy) },
      r: r3(r),
      a0: r3(a0),
      a1: r3(a1),
    });

  // ---- 底板铰线（墙 / H4）与锁孔 ----
  c.line('crease', -T, -root, T, -root); // 前墙铰线
  c.line('crease', -T, root, T, root); // 后墙铰线
  for (const sx of [1, -1] as const) {
    // H4 铰线（三段，避开底板锁孔区）
    for (const [a, b] of [
      [-halfW, -(holeC + hh)],
      [-(holeC - hh), holeC - hh],
      [holeC + hh, halfW],
    ] as [number, number][]) {
      c.line('crease', sx * S, a, sx * S, b);
    }
    for (const sy of [1, -1] as const) c.polyline('cut', lockHole(sx, sy), true);
  }

  // ---- 墙轮廓 ----
  c.line('cut', -T, root + H1, T, root + H1); // 后墙顶边
  if (spec.lid === 'none') {
    c.line('cut', -T, -(root + H1), T, -(root + H1)); // 前墙顶边（直线）
  } else {
    c.line('cut', T, -(root + H1), G, y0); // 肩斜边（右）
    c.line('cut', -G, y0, -T, -(root + H1)); // 肩斜边（左）；颈顶 = 盖铰线，盖部绘制
  }
  if (root + H1 > tongueTop + 0.01) {
    // 墙左右上段（角舌铰线顶 → 墙顶；427 角舌通高则长度 0 跳过）
    c.line('cut', T, -tongueTop, T, -(root + H1));
    c.line('cut', -T, -(root + H1), -T, -tongueTop);
    c.line('cut', T, tongueTop, T, root + H1);
    c.line('cut', -T, root + H1, -T, tongueTop);
  }

  // ---- 角舌 ×4（开放轮廓 + 铰线；底板斜边 / H4 上下边为共享切缝，只画一次）----
  const seg2end = deep ? S + H4len : T + D1; // 段2 终点（深模式 = H4 边全长 / 浅模式至 T+D1）
  const R3x = S + H4len + 3; // 角舌角 R3 圆心 x（JSON 固定值）
  const drawTongue = (sx: 1 | -1, sy: 1 | -1) => {
    const X = (v: number) => sx * v;
    const Y = (v: number) => sy * v; // y 值按后区（正）书写，Y 翻转到前区
    c.line('cut', X(T), Y(root), X(S), Y(halfW)); // 段1：底板斜边
    c.line('cut', X(S), Y(halfW), X(seg2end), Y(halfW)); // 段2：H4 上/下边
    if (deep) {
      c.line('cut', X(S + H4len), Y(halfW), X(S + H4len), Y(halfW + 2.55)); // 段3：台阶竖边
      // R3 圆角（x 镜像 {180°-a1, 180°-a0}，y 镜像取负）
      const [a0, a1] =
        sx > 0
          ? sy > 0 ? [101.53, 180] : [180, 258.47]
          : sy > 0 ? [0, 78.47] : [281.53, 360];
      arcCut(X(R3x), Y(halfW + 2.55), 3, a0, a1);
      c.line('cut', X(S + H4len + 2.4), Y(halfW + 5.49), X(T + D1), Y(halfW + 15)); // 段4'：斜边（自弧端点）
      c.line('cut', X(T + D1), Y(halfW + 15), X(T + D1), Y(tongueTop)); // 段5：竖边
    } else {
      c.line('cut', X(T + D1), Y(halfW), X(T + D1), Y(tongueTop)); // 竖边
    }
    c.line('cut', X(T + D1), Y(tongueTop), X(T), Y(tongueTop)); // 顶边
    c.line('crease', X(T), Y(root), X(T), Y(tongueTop)); // 角舌铰线
  };
  drawTongue(1, -1);
  drawTongue(-1, -1);
  drawTongue(1, 1);
  drawTongue(-1, 1);

  // ---- H4：条铰线 + 浅模式上/下边剩余段 ----
  c.line('crease', S + H4len, -halfW, S + H4len, halfW); // stripR 铰线
  c.line('crease', -(S + H4len), -halfW, -(S + H4len), halfW); // stripL 铰线
  if (!deep) {
    c.line('cut', T + D1, -halfW, S + H4len, -halfW);
    c.line('cut', T + D1, halfW, S + H4len, halfW);
    c.line('cut', -(S + H4len), -halfW, -(T + D1), -halfW);
    c.line('cut', -(S + H4len), halfW, -(T + D1), halfW);
  }

  // ---- 条（上下斜边；右竖边 = H3 铰线）+ H3 轮廓 ----
  for (const sx of [1, -1] as const) {
    c.line('cut', sx * (S + H4len), halfW, sx * X3w, H3half); // 条上斜边
    c.line('crease', sx * X3w, -H3half, sx * X3w, H3half); // H3 铰线（条右竖边）
    c.line('cut', sx * X3w, -H3half, sx * (S + H4len), -halfW); // 条下斜边
  }
  c.polyline('cut', h3R); // H3 轮廓（开放：首尾即铰线端点）
  c.polyline('cut', mirX(h3R));

  if (spec.lid === 'tuck') {
    // ---- 0421 盖部：盖 + 插舌 ----
    const Tw = G - 18;
    c.line('cut', G, y0, G, yt + 9); // 盖右竖边
    c.line('cut', G, yt + 9, G - 9, yt); // 右上斜角
    c.line('cut', G - 9, yt, -(G - 9), yt); // 盖顶边
    c.line('cut', -(G - 9), yt, -G, yt + 9); // 左上斜角
    c.line('cut', -G, yt + 9, -G, y0); // 盖左竖边
    c.line('crease', -G, y0, G, y0); // 盖铰线（= 颈顶）
    c.line('cut', Tw, yt, Tw, yt - 10); // 舌右竖边
    c.line('cut', Tw, yt - 10, Tw - 20, yt - 30); // 右斜边
    c.line('cut', Tw - 20, yt - 30, -(Tw - 20), yt - 30); // 舌底边
    c.line('cut', -(Tw - 20), yt - 30, -Tw, yt - 10); // 左斜边
    c.line('cut', -Tw, yt - 10, -Tw, yt); // 舌左竖边
    c.line('crease', -Tw, yt, Tw, yt); // 舌铰线
  } else if (spec.lid === 'earlock') {
    // ---- 427 盖部：盖 + 双耳 + 大舌 + 双弹簧耳 ----
    const TE = T + 4;
    const H7 = 50;
    const earD1 = H7 - 10 + 10 * Math.sin(rad15);
    const earD1t = earD1 * Math.tan(rad15);
    const earD2 = earD1t + 10 * Math.cos(rad15);
    // 盖（矩形，盖铰线 = 颈顶）
    c.line('cut', G, y0, G, yt);
    c.line('cut', G, yt, -G, yt);
    c.line('cut', -G, yt, -G, y0);
    c.line('crease', -G, y0, G, y0);
    // 耳 ×2（颈端斜切边 → R10 → 外直边 → R10 → 舌端斜切边）
    for (const sx of [1, -1] as const) {
      const X = (v: number) => sx * v;
      c.line('cut', X(G), y0 - 10, X(G + earD1), y0 - 10 - earD1t);
      arcCut(X(G + 40), y0 - 10 - earD2, 10, sx > 0 ? 0 : 105, sx > 0 ? 75 : 180);
      c.line('cut', X(G + H7), y0 - 10 - earD2, X(G + H7), yt + 10 + earD2); // 外直边
      arcCut(X(G + 40), yt + 10 + earD2, 10, sx > 0 ? 285 : 180, sx > 0 ? 360 : 255);
      c.line('cut', X(G + earD1), yt + 10 + earD1t, X(G), yt + 10);
      c.line('crease', X(G), y0 - 10, X(G), yt + 10); // 耳铰线
    }
    // 大舌（轮廓避开大舌铰线与弹簧耳铰线；指尖 R10）
    c.line('cut', G, yt, G, yt - 4); // 右短竖
    c.line('cut', G, yt - 4, TE, yt - 4); // 右底缘条
    c.line('cut', TE, yt - 97, TE, yt - 100); // 右顶短竖
    c.line('cut', TE, yt - 100, 10, yt - 100); // 顶边右
    arcCut(0, yt - 100, 10, 0, 90); // 指尖右弧
    arcCut(0, yt - 100, 10, 90, 180); // 指尖左弧
    c.line('cut', -10, yt - 100, -TE, yt - 100); // 顶边左
    c.line('cut', -TE, yt - 100, -TE, yt - 97); // 左顶短竖
    c.line('cut', -TE, yt - 4, -G, yt - 4); // 左底缘条
    c.line('cut', -G, yt - 4, -G, yt); // 左短竖
    c.line('crease', -G, yt, G, yt); // 大舌铰线
    // 弹簧耳 ×2（短边 → R20 → 连边 → R97；铰线 = 大舌竖边，微翘 5° 自锁）
    for (const sx of [1, -1] as const) {
      const X = (v: number) => sx * v;
      c.line('cut', X(TE), yt - 4, X(TE + 66.65), yt - 28.26);
      if (sx > 0) arcCut(TE + 59.81, yt - 47.05, 20, 325, 430);
      else arcCut(-(TE + 59.81), yt - 47.05, 20, 110, 215);
      c.line('cut', X(TE + 76.2), yt - 58.53, X(TE + 70.59), yt - 66.53);
      if (sx > 0) arcCut(TE, yt, 97, 270, 316.7);
      else arcCut(-TE, yt, 97, 223.3, 270);
      c.line('crease', X(TE), yt - 4, X(TE), yt - 97); // 弹簧耳铰线
    }
  }

  // ---- meta ----
  const bb = bbox(c.entities);
  const warnings = commonWarnings(p, make).filter((w) => !w.includes('糊口'));
  if (H > W) warnings.push('高度大于宽度，托盘端部结构偏深，建议复核');
  if (halfW < 73) warnings.push('宽度偏小，端部锁孔/锁舌空间紧张');
  warnings.push('免胶自锁：端部多层瓦楞叠压互锁，成型无需胶合');
  return {
    entities: c.entities,
    panels: [base],
    meta: {
      makeSize: { l: L, w: W, h: H },
      unfold: { w: bb.max.x - bb.min.x, h: bb.max.y - bb.min.y },
      areaM2: ((bb.max.x - bb.min.x) * (bb.max.y - bb.min.y)) / 1e6,
      warnings,
    },
  };
}

const fields = COMMON_FIELDS.filter((f) => f.key !== 'glueFlap' && f.key !== 'chamfer');

export const rollTray0422 = {
  id: 'roll-tray-0422',
  name: '0422 卷边托盘（双壁免胶）',
  category: '瓦楞纸箱',
  fields,
  build: (p: BoxParams) => buildRollTray(p, SPEC_0422),
};

export const rollTray0421 = {
  id: 'roll-tray-0421',
  name: '0421 卷边托盘（铰接盖）',
  category: '瓦楞纸箱',
  fields,
  build: (p: BoxParams) => buildRollTray(p, SPEC_0421),
};

export const trayEarlock427 = {
  id: 'tray-earlock-427',
  name: '427 耳锁盖托盘',
  category: '瓦楞纸箱',
  fields,
  build: (p: BoxParams) => buildRollTray(p, SPEC_427),
};
