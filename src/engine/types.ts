/**
 * 几何引擎实体模型（框架无关的纯数据结构）
 *
 * 坐标约定：
 * - 单位：mm（内部全精度浮点，导出时四舍五入到 3 位小数）
 * - 坐标系：y 轴向下（与 SVG / Canvas 一致），导出 DXF/PDF 时统一翻转为 CAD 习惯的 y-up
 * - 原点：展开图左上角附近（builder 自由布局，渲染层自动 fit）
 */

/** 图层：制版行业惯例，切线 / 压痕 / 齿刀 / 废料 / 标注 分层 */
export type Layer = 'cut' | 'crease' | 'perf' | 'dim';

export interface Pt {
  x: number;
  y: number;
}

export type Entity =
  | { kind: 'line'; layer: Layer; a: Pt; b: Pt }
  /** 圆弧：圆心 c、半径 r、起始角 a0 → 终止角 a1（度，数学正方向） */
  | { kind: 'arc'; layer: Layer; c: Pt; r: number; a0: number; a1: number }
  | { kind: 'circle'; layer: Layer; c: Pt; r: number };

/**
 * 3D 折叠面板树（builder 与 2D 实体同源生成，保证 2D/3D 一致）
 *
 * 坐标：poly 用 2D 展开平面（y 向下）；3D 构建时做 y 翻转
 * 铰链：'v' 列间竖向折线（at = x）；'h' 端部水平折线（at = y2d）
 * sign：v 折 子面板在折线左侧=+1 / 右侧=-1；h 折 展开图上方=+1 / 下方=-1
 */
export interface PanelNode {
  id: string;
  /** 展开平面轮廓（2D y-down，mm） */
  poly: [number, number][];
  /** 面板内开孔（如展示盒开窗，轮廓同 2D y-down 坐标） */
  holes?: [number, number][][];
  hinge?: { kind: 'v' | 'h'; at: number; sign: 1 | -1 };
  /** 成型最终角（度，默认 90）；叠层微调避免面片共面 z-fighting */
  finalDeg?: number;
  /** 折叠窗口起点显式覆盖（0..1，默认按 kind+depth 推断）——换根后 depth 不再对应成型工序时使用 */
  phase?: number;
  children: PanelNode[];
}

export interface DielineMeta {
  /** 换算后的制造尺寸（mm） */
  makeSize: { l: number; w: number; h: number };
  /** 展开幅面（cut 包围盒） */
  unfold: { w: number; h: number };
  /** 展开毛面积（m²） */
  areaM2: number;
  /** 摇盖深度（0201 系） */
  flaps?: { f1: number; f2: number };
  /** 工艺校验警告 */
  warnings: string[];
}

export interface DielineResult {
  entities: Entity[];
  /** 3D 面板树（多根 = 多部件，如天地盖的底+盖） */
  panels: PanelNode[];
  meta: DielineMeta;
}

/** 实体包围盒 */
export function bbox(entities: Entity[]): { min: Pt; max: Pt } {
  const min: Pt = { x: Infinity, y: Infinity };
  const max: Pt = { x: -Infinity, y: -Infinity };
  const eat = (x: number, y: number) => {
    if (x < min.x) min.x = x;
    if (y < min.y) min.y = y;
    if (x > max.x) max.x = x;
    if (y > max.y) max.y = y;
  };
  for (const e of entities) {
    if (e.kind === 'line') {
      eat(e.a.x, e.a.y);
      eat(e.b.x, e.b.y);
    } else if (e.kind === 'arc' || e.kind === 'circle') {
      eat(e.c.x - e.r, e.c.y - e.r);
      eat(e.c.x + e.r, e.c.y + e.r);
    }
  }
  if (!isFinite(min.x)) return { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } };
  return { min, max };
}

/** 数值格式化：导出用 3 位小数 */
export function r3(x: number): number {
  return Math.round(x * 1000) / 1000;
}
