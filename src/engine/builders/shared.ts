/**
 * 管式盒（tube box）通用骨架
 *
 * 2D 布局（y 向下，横排面板）：
 *   [糊口 g][侧面 W][正面 L][侧面 W][背面 L]
 *   主体区高 H，上/下端各接端部结构（摇盖/插舌盖/全底板/自锁底/开口）
 *
 * 3D 面板树（PanelNode）与 2D 实体同源生成，保证 2D/3D 一致：
 *   根 = col2（正面，折叠全程平铺贴地），col1/col3 挂根，col4 挂 col3，
 *   糊口挂 col1，端部结构挂各自列面板；成型直接落 L×W×H 平躺姿态
 */
import { Entity, Layer, PanelNode, r3 } from '../types';

/** 实体收集器：builder 内部使用的轻量绘制工具 */
export class EntCollector {
  entities: Entity[] = [];

  line(layer: Layer, x1: number, y1: number, x2: number, y2: number) {
    this.entities.push({
      kind: 'line',
      layer,
      a: { x: r3(x1), y: r3(y1) },
      b: { x: r3(x2), y: r3(y2) },
    });
  }

  /** 折线（自动拆成 line 实体） */
  polyline(layer: Layer, pts: [number, number][], closed = false) {
    for (let i = 0; i < pts.length - 1; i++) {
      this.line(layer, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    }
    if (closed && pts.length > 2) {
      const a = pts[pts.length - 1];
      const b = pts[0];
      this.line(layer, a[0], a[1], b[0], b[1]);
    }
  }
}

/** 平移一组实体（组合部件用，如天地盖的底+盖） */
export function translateEntities(ents: Entity[], dx: number, dy: number): Entity[] {
  const mv = (p: { x: number; y: number }) => ({ x: r3(p.x + dx), y: r3(p.y + dy) });
  return ents.map((e) => {
    if (e.kind === 'line') return { ...e, a: mv(e.a), b: mv(e.b) };
    if (e.kind === 'arc' || e.kind === 'circle') return { ...e, c: mv(e.c) };
    return e;
  });
}

/** 平移面板树（组合部件用） */
export function translatePanels(trees: PanelNode[], dx: number, dy: number): PanelNode[] {
  const walk = (n: PanelNode): PanelNode => ({
    ...n,
    poly: n.poly.map(([x, y]) => [r3(x + dx), r3(y + dy)] as [number, number]),
    hinge: n.hinge
      ? { ...n.hinge, at: n.hinge.kind === 'v' ? n.hinge.at + dx : n.hinge.at + dy }
      : undefined,
    children: n.children.map(walk),
  });
  return trees.map(walk);
}

/** 端部结构类型 */
export type EndSpec =
  | { type: 'none' } // 开口（边缘裁切）
  // 摇盖：内摇盖（col1/col3，W 面）深 F，外摇盖（col2/col4，L 面）深 Fout（默认 = F）
  // degStep：外盖层间错层角（避免 3D 面片共面 z-fighting）
  | { type: 'rockets'; F: number; slot: number; Fout?: number; degStep?: number }
  // 插舌盖：主盖深 W + 插舌 tongue；mirror = 主盖换到 col4（反插盒，另一端插舌方向转 90°）
  | { type: 'tuck'; tongue: number; mirror?: boolean }
  | { type: 'fullBase' } // 全底板 + 锁舌 + 防尘翼（飞机盒底 / 天地盖）
  | { type: 'lockBottom' }; // 自锁底（简化 crash-lock 几何）

export interface TubeInput {
  /** 制造尺寸 */
  L: number;
  W: number;
  H: number;
  /** 糊口宽、糊口斜切 */
  g: number;
  ch: number;
  top: EndSpec;
  bottom: EndSpec;
}

/** 端部结构占用的展开高度 */
export function endHeight(e: EndSpec, W: number): number {
  switch (e.type) {
    case 'none':
      return 0;
    case 'rockets':
      return Math.max(e.F, e.Fout ?? e.F);
    case 'tuck':
      return W + e.tongue; // 主盖 + 插舌最深
    case 'fullBase':
      return W; // 全底板最深
    case 'lockBottom':
      return W / 2 + 5; // 底板深 + 锁舌凸出
  }
}

/** 摇盖各列深度：内摇盖（col1/col3）= F，外摇盖（col2/col4）= Fout */
function rocketDepths(spec: Extract<EndSpec, { type: 'rockets' }>): [number, number, number, number] {
  const Fout = spec.Fout ?? spec.F;
  return [spec.F, Fout, spec.F, Fout];
}

/**
 * 绘制端部结构 2D 实体（在基线 y0 的一侧）
 * @param s 方向：-1 = 主体上方（顶部），+1 = 主体下方（底部）
 */
function drawEnd(c: EntCollector, s: 1 | -1, spec: EndSpec, xs: number[], y0: number, W: number) {
  const seg = (x1: number, d1: number, x2: number, d2: number, layer: Layer = 'cut') =>
    c.line(layer, x1, y0 + s * d1, x2, y0 + s * d2);

  switch (spec.type) {
    case 'none': {
      // 开口边缘：裁切线（糊口斜切线已画到 (g, y0)）
      seg(xs[1], 0, xs[5], 0);
      break;
    }

    case 'rockets': {
      // 0201 系摇盖：基线全宽折线；col1..col4 各一片摇盖（深度独立），
      // 相邻摇盖间开槽缝（缝宽 slot，切通至较深摇盖的深度）
      const { slot } = spec;
      const depths = rocketDepths(spec);
      seg(xs[1], 0, xs[5], 0, 'crease');
      for (let i = 1; i <= 4; i++) {
        const d = depths[i - 1];
        const x0 = i === 1 ? xs[1] : xs[i] + slot / 2;
        const x1 = i === 4 ? xs[5] : xs[i + 1] - slot / 2;
        seg(x0, 0, x0, d);
        seg(x0, d, x1, d);
        seg(x1, d, x1, 0);
      }
      break;
    }

    case 'tuck': {
      // 插舌盖：主盖 + 末端插舌（梯形收窄）；耳片一对；对面列开口
      // mirror=false：主盖 col2、耳片 col1/col3、开口 col4
      // mirror=true ：主盖 col4、耳片 col1/col3、开口 col2（反插：两端插舌方向相差 90°）
      const { tongue } = spec;
      const inset = 6; // 插舌侧收（窄于主盖）
      const ts = 4; // 舌角斜切
      const coverD = W;
      const x0 = spec.mirror ? xs[4] : xs[2];
      const x1 = spec.mirror ? xs[5] : xs[3];
      // 主盖左右竖边
      seg(x0, 0, x0, coverD);
      seg(x1, 0, x1, coverD);
      // 主盖顶边 + 插舌轮廓（梯形收窄）
      const tx0 = x0 + inset;
      const tx1 = x1 - inset;
      seg(x0, coverD, tx0, coverD);
      seg(tx0, coverD, tx0 + ts, coverD + tongue);
      seg(tx0 + ts, coverD + tongue, tx1 - ts, coverD + tongue);
      seg(tx1 - ts, coverD + tongue, tx1, coverD);
      seg(tx1, coverD, x1, coverD);
      // 折线：主盖根 + 舌根
      seg(x0, 0, x1, 0, 'crease');
      seg(x0, coverD, x1, coverD, 'crease');
      // 耳片（col1 / col3，两种镜像共用）
      const earD = Math.min(0.6 * W, W / 2 + 10);
      const ec = Math.min(earD * 0.5, W / 2);
      for (const [a, b] of [
        [xs[1], xs[2]],
        [xs[3], xs[4]],
      ] as [number, number][]) {
        seg(a, 0, a + ec, earD);
        seg(a + ec, earD, b - ec, earD);
        seg(b - ec, earD, b, 0);
        seg(a, 0, b, 0, 'crease');
      }
      // 对面列端部：开口边缘
      if (spec.mirror) seg(xs[2], 0, xs[3], 0);
      else seg(xs[4], 0, xs[5], 0);
      break;
    }

    case 'fullBase': {
      // 全底板（col4，深 W，四角小切）+ 锁舌（col2）+ 防尘翼（col1/col3）
      const d = W / 2 + 4;
      // col4 全底板
      const fx0 = xs[4];
      const fx1 = xs[5];
      const fc = Math.min(4, W / 4);
      seg(fx0, 0, fx0, W - fc);
      seg(fx0, W - fc, fx0 + fc, W);
      seg(fx0 + fc, W, fx1 - fc, W);
      seg(fx1 - fc, W, fx1, W - fc);
      seg(fx1, W - fc, fx1, 0);
      seg(fx0, 0, fx1, 0, 'crease');
      // col2 锁舌（两侧 45° 大斜切）
      const lx0 = xs[2];
      const lx1 = xs[3];
      const lc = Math.min(8, W / 4);
      seg(lx0, 0, lx0 + lc, d);
      seg(lx0 + lc, d, lx1 - lc, d);
      seg(lx1 - lc, d, lx1, 0);
      seg(lx0, 0, lx1, 0, 'crease');
      // col1 / col3 防尘翼
      const ec = Math.min(d * 0.55, W / 2);
      for (const [a, b] of [
        [xs[1], xs[2]],
        [xs[3], xs[4]],
      ] as [number, number][]) {
        seg(a, 0, a + ec, d);
        seg(a + ec, d, b - ec, d);
        seg(b - ec, d, b, 0);
        seg(a, 0, b, 0, 'crease');
      }
      break;
    }

    case 'lockBottom': {
      // 自锁底（简化 crash-lock 几何）：
      // col2/col4 半深底板（两侧 45° 斜切）；col1/col3 锁板（斜压痕 + 锁舌）
      const d = W / 2;
      const cc = d * 0.35;
      for (const [a, b] of [
        [xs[2], xs[3]],
        [xs[4], xs[5]],
      ] as [number, number][]) {
        seg(a, 0, a + cc, d);
        seg(a + cc, d, b - cc, d);
        seg(b - cc, d, b, 0);
        seg(a, 0, b, 0, 'crease');
      }
      for (const [a, b] of [
        [xs[1], xs[2]],
        [xs[3], xs[4]],
      ] as [number, number][]) {
        const mid = (a + b) / 2;
        seg(a, 0, a + cc, d);
        seg(a + cc, d, mid - 7, d);
        seg(mid - 7, d, mid - 4, d + 5);
        seg(mid - 4, d + 5, mid + 4, d + 5);
        seg(mid + 4, d + 5, mid + 7, d);
        seg(mid + 7, d, b - cc, d);
        seg(b - cc, d, b, 0);
        seg(a, 0, b, 0, 'crease');
        // 斜压痕：自锁底的特征折线（折合时底部自动成型）
        seg(a, 0, a + d, d, 'crease');
        seg(b, 0, b - d, d, 'crease');
      }
      break;
    }
  }
}

/* ================= 3D 面板树生成 ================= */

/**
 * 端部结构 → 各列（col1..col4）的 3D 面板子节点
 * 几何数值与 drawEnd 完全同源，仅取轮廓多边形
 * @param s -1 = 顶部 / +1 = 底部
 */
function endPanels(spec: EndSpec, s: 1 | -1, y0: number, xs: number[], W: number, tongue: number): PanelNode[][] {
  // col1..col4 的 children
  const out: PanelNode[][] = [[], [], [], []];
  const hs: 1 | -1 = s === -1 ? 1 : -1; // h 折 sign：顶部 +1 / 底部 -1
  const D = (d: number) => (s === -1 ? y0 - d : y0 + d); // 端部深度 d 处的 y（2D y-down）

  const push = (col: number, n: PanelNode) => out[col - 1].push(n);

  switch (spec.type) {
    case 'none':
      break;

    case 'rockets': {
      // 摇盖：col1..col4 各一片矩形（深度独立，与 drawEnd 同源）
      const { slot } = spec;
      const depths = rocketDepths(spec);
      const step = spec.degStep ?? 1.2;
      for (let i = 1; i <= 4; i++) {
        const d = depths[i - 1];
        const x0 = i === 1 ? xs[1] : xs[i] + slot / 2;
        const x1 = i === 4 ? xs[5] : xs[i + 1] - slot / 2;
        const inner = i === 1 || i === 3; // 内摇盖（挂侧面 col1/col3，宽 W）
        push(i, {
          id: `flap-${s === -1 ? 't' : 'b'}${i}`,
          poly: [
            [x0, y0],
            [x1, y0],
            [x1, D(d)],
            [x0, D(d)],
          ],
          hinge: { kind: 'h', at: y0, sign: hs },
          // 封箱工序：先折内摇盖（宽 W）→ 再折外摇盖（长 L）盖在内摇盖上面。
          // 层序角：多折（>90°）面偏向管体内侧 = 里层，少折（<90°）= 外层——
          // 内摇盖 90+step 向管内让位；外摇盖 90-step 叠在外层，
          // col4 后折再让一层（全叠盖盒型 col2/col4 满宽互叠时 col4 压在 col2 上）
          phase: inner ? 0.44 : 0.74,
          finalDeg: inner ? 90 + step : 90 - step * (i === 4 ? 2 : 1),
          children: [],
        });
      }
      break;
    }

    case 'tuck': {
      // col1/col3 耳片；主盖（mirror 时挂 col4，否则 col2）+ 插舌（两级）
      const earD = Math.min(0.6 * W, W / 2 + 10);
      const ec = Math.min(earD * 0.5, W / 2);
      for (const i of [1, 3]) {
        push(i, {
          id: `ear-${s === -1 ? 't' : 'b'}${i}`,
          poly: [
            [xs[i], y0],
            [xs[i] + ec, D(earD)],
            [xs[i + 1] - ec, D(earD)],
            [xs[i + 1], y0],
          ],
          hinge: { kind: 'h', at: y0, sign: hs },
          // 耳片先折入管口内（里层）：多折 >90° 向管内让位
          phase: 0.44,
          finalDeg: 91.2,
          children: [],
        });
      }
      const inset = 6;
      const ts = 4;
      const coverD = W;
      const mx0 = spec.mirror ? xs[4] : xs[2];
      const mx1 = spec.mirror ? xs[5] : xs[3];
      const coverCol = spec.mirror ? 4 : 2;
      // 插舌：挂在主盖远端，与主盖同向折合（手风琴式折入管口内、贴对面内壁；
      // 此前 sign 与主盖相反，插舌凸出管外一个舌深）
      // 角度与主盖合成 180°（88.8 + 91.2），平贴主盖背面伸入管内
      const tongueNode: PanelNode = {
        id: `tongue-${s === -1 ? 't' : 'b'}`,
        poly: [
          [mx0 + inset, D(coverD)],
          [mx0 + inset + ts, D(coverD + tongue)],
          [mx1 - inset - ts, D(coverD + tongue)],
          [mx1 - inset, D(coverD)],
        ],
        hinge: { kind: 'h', at: D(coverD), sign: hs },
        finalDeg: 91.2,
        children: [],
      };
      push(coverCol, {
        id: `cover-${s === -1 ? 't' : 'b'}`,
        poly: [
          [mx0, y0],
          [mx1, y0],
          [mx1, D(coverD)],
          [mx0, D(coverD)],
        ],
        hinge: { kind: 'h', at: y0, sign: hs },
        // 主盖后折盖在耳片之上（外层）：少折 <90° 向管外错层
        phase: 0.74,
        finalDeg: 88.8,
        children: [tongueNode],
      });
      break;
    }

    case 'fullBase': {
      // col4 全底板（最外层）→ col1/col3 防尘翼 → col2 锁舌（最内层）
      push(4, {
        id: 'base-4',
        poly: [
          [xs[4], y0],
          [xs[5], y0],
          [xs[5], D(W)],
          [xs[4], D(W)],
        ],
        hinge: { kind: 'h', at: y0, sign: hs },
        finalDeg: 90,
        children: [],
      });
      const d = W / 2 + 4;
      const ec = Math.min(d * 0.55, W / 2);
      for (const i of [1, 3]) {
        push(i, {
          id: `dust-${i}`,
          poly: [
            [xs[i], y0],
            [xs[i] + ec, D(d)],
            [xs[i + 1] - ec, D(d)],
            [xs[i + 1], y0],
          ],
          hinge: { kind: 'h', at: y0, sign: hs },
          finalDeg: 91.2,
          children: [],
        });
      }
      const lc = Math.min(8, W / 4);
      push(2, {
        id: 'lock-2',
        poly: [
          [xs[2], y0],
          [xs[2] + lc, D(d)],
          [xs[3] - lc, D(d)],
          [xs[3], y0],
        ],
        hinge: { kind: 'h', at: y0, sign: hs },
        finalDeg: 92.4,
        children: [],
      });
      break;
    }

    case 'lockBottom': {
      // col2/col4 半深底板 + col1/col3 锁板（含凸舌与斜压痕简化）
      const d = W / 2;
      const cc = d * 0.35;
      push(2, {
        id: 'lb-2',
        poly: [
          [xs[2], y0],
          [xs[2] + cc, D(d)],
          [xs[3] - cc, D(d)],
          [xs[3], y0],
        ],
        hinge: { kind: 'h', at: y0, sign: hs },
        finalDeg: 91.2,
        children: [],
      });
      push(4, {
        id: 'lb-4',
        poly: [
          [xs[4], y0],
          [xs[4] + cc, D(d)],
          [xs[5] - cc, D(d)],
          [xs[5], y0],
        ],
        hinge: { kind: 'h', at: y0, sign: hs },
        finalDeg: 90,
        children: [],
      });
      for (const i of [1, 3]) {
        const mid = (xs[i] + xs[i + 1]) / 2;
        push(i, {
          id: `lbp-${i}`,
          poly: [
            [xs[i], y0],
            [xs[i] + cc, D(d)],
            [mid - 7, D(d)],
            [mid - 4, D(d + 5)],
            [mid + 4, D(d + 5)],
            [mid + 7, D(d)],
            [xs[i + 1] - cc, D(d)],
            [xs[i + 1], y0],
          ],
          hinge: { kind: 'h', at: y0, sign: hs },
          finalDeg: 92.4,
          children: [],
        });
      }
      break;
    }
  }
  return out;
}

/**
 * 生成管式盒 3D 面板树（根 = col2 正面）
 * 根面板折叠全程平铺贴地（不转），盒子直接折合成 L×W×H 平躺姿态，
 * 全程无整体翻转（旧方案根 = col3，成型立式后靠翻转台整体滚转 90° 放倒，观感"中途换向"）
 * 列间 v 折 sign：子面板在折线左侧 +1（绕 +Y 正转），右侧 -1
 */
function buildPanelTree(xs: number[], T: number, H: number, g: number, ch: number, top: EndSpec, bottom: EndSpec, W: number, tongue: number): PanelNode {
  const colX = (i: number) => [xs[i], xs[i + 1]] as const;

  const mkCol = (i: number): PanelNode => {
    const [x0, x1] = colX(i);
    return {
      id: `col${i}`,
      poly: [
        [x0, T],
        [x1, T],
        [x1, T + H],
        [x0, T + H],
      ],
      children: [],
    };
  };

  const c1 = mkCol(1);
  const c2 = mkCol(2); // 根（正面，折叠全程平铺贴地 = 成型后盒底）
  const c3 = mkCol(3);
  const c4 = mkCol(4);

  // 列间铰链（col2 为根；sign 只看子面板在折线的哪一侧，与层级无关）
  c1.hinge = { kind: 'v', at: xs[2], sign: 1 }; // col1 在 xs[2] 左侧
  c3.hinge = { kind: 'v', at: xs[3], sign: -1 }; // col3 在 xs[3] 右侧
  c4.hinge = { kind: 'v', at: xs[4], sign: -1 }; // col4 在 xs[4] 右侧（挂 col3 下）

  // 端部结构挂列
  const topEnds = endPanels(top, -1, T, xs, W, tongue);
  const botEnds = endPanels(bottom, 1, T + H, xs, W, tongue);
  [c1, c2, c3, c4].forEach((c, i) => {
    c.children.push(...topEnds[i], ...botEnds[i]);
  });

  // 层级：col1 → col2（根）；col3 → col2；col4 → col3
  // 工序波次：col1/col3 立壁(0.02) → col4 合拢 + 糊口包贴(0.14)
  //   → 端部内层先折(0.44：摇盖内摇盖/插舌耳片/自锁底舌) → 外层盖合(0.74：外摇盖/主盖)
  //   （端部各层的先后由 endPanels 里显式 phase 指定，不再依赖 depth 推断）
  c2.children.push(c1, c3);
  c3.children.push(c4);

  // 糊口：col1 左缘延伸（折线 xs[1]），成型后沿环绕方向包贴到 col4 外壁
  // （此前误挂 col4、铰链在 xs[5]，导致成型时糊口绕 1300mm 外的轴飞离盒体）
  c1.children.push({
    id: 'glue',
    poly: [
      [0, T + ch],
      [g, T],
      [g, T + H],
      [0, T + H - ch],
    ],
    hinge: { kind: 'v', at: xs[1], sign: 1 },
    finalDeg: 92.4, // 最外层：贴 col4 外壁微错层，避免共面 z-fighting
    children: [],
  });

  return c2;
}

/**
 * 生成管式盒展开图（含糊口与两端结构 + 3D 面板树）
 */
export function tubeWithEnds(inp: TubeInput): { entities: Entity[]; panels: PanelNode[]; TW: number; TH: number } {
  const { L, W, H, g, ch, top, bottom } = inp;
  // 插舌深（tuck 端部用；其余端部忽略）
  const tongue = top.type === 'tuck' ? top.tongue : bottom.type === 'tuck' ? bottom.tongue : 0;

  const c = new EntCollector();
  // 列边界：[糊口][侧 W][正 L][侧 W][背 L]
  const xs = [0, g, g + W, g + W + L, g + 2 * W + L, g + 2 * W + 2 * L];
  const TW = xs[5];
  const topH = endHeight(top, W);
  const botH = endHeight(bottom, W);
  const T = topH; // 主体区顶部 y
  const TH = topH + H + botH;

  // 主体面板竖向折线（4 条：糊口折线 + 3 条面板分界）
  for (let i = 1; i <= 4; i++) {
    c.line('crease', xs[i], T, xs[i], T + H);
  }

  // 糊口：左竖边 + 上下斜切（ch=0 时为矩形）
  const chc = Math.max(0, Math.min(ch, H / 2));
  c.line('cut', 0, T + chc, g, T);
  c.line('cut', 0, T + H - chc, g, T + H);
  c.line('cut', 0, T + chc, 0, T + H - chc);

  // 主体右缘：col4 右边界裁切线（端部结构竖边只覆盖端部区，中段必须补齐，
  // 否则轮廓在右侧不闭合——此前被浅灰幅面外框掩盖为"灰线"）
  c.line('cut', xs[5], T, xs[5], T + H);

  // 两端结构
  drawEnd(c, -1, top, xs, T, W);
  drawEnd(c, 1, bottom, xs, T + H, W);

  // 3D 面板树
  const panels = [buildPanelTree(xs, T, H, g, chc, top, bottom, W, tongue)];

  return { entities: c.entities, panels, TW, TH };
}
