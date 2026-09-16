/**
 * 3D 渲染器：PanelNode 树 → Three.js 铰链层级 + 顺序折叠动画
 *
 * 坐标变换（展开平面 → 3D）：纸板平铺在水平地面上
 *   3D = (x, 0, -y2d)（2D y-down → 世界 -z 水平；世界 y 竖直向上）
 *   铰链 pivot：'v' 折线（2D 竖直 x=at）→ (at, 0, 0) 绕世界 Z 轴折起（壁竖起）
 *              'h' 折线（2D 水平 y=at）→ (0, 0, -at) 绕世界 X 轴折合（摇盖）
 *   mesh 顶点 = 世界(展开) - 自身pivot；子 group.position = 子pivot - 父pivot
 *
 * 姿态（直接平躺成型）：树根面板 = 成型后恰好水平的面（管式盒=正面 col2、
 *   托盘式=前壁/脊），折叠全程不转、恒平铺贴地；其余面板绕固定铰链逐波折合，
 *   盒子从头到尾朝向不变，直接折合成 L×W×H 平躺姿态（x=L、y=W 竖直、z=H）。
 *   多部件盒型（天地盖/抽屉盒）每棵树独立部件组，成型后并排落地、分别贴地
 *
 * 顺序折叠（阶段窗口）：折叠不是同时进行，而是按真实成型工序分先后：
 *   ① 0.02 围筒 v 折（两侧壁立起）  ② 0.14 合拢 + 糊口包贴
 *   ③ 0.44+ 摇盖/耳片 h 折（finalDeg 层序：内盖 → 外盖错开）  ④ 0.74 插舌收尾
 * 每个铰链在 [phase, phase+SPAN] 全局进度窗口内完成自身旋转（node.phase 显式覆盖），
 * 相邻阶段少量重叠，动画呈"波次推进"；反向播放即开箱顺序（先拔舌开盖 → 摊平）
 *
 * 折叠方向（右手系验证）：
 *   v 折：子面板在折线左侧（dx<0）绕 -Z 转 → +Y 竖起（rotation.z = -rad·sign）
 *   h 折：端部绕 -X 转折向筒内（rotation.x = -rad·sign）
 */
import * as THREE from 'three';
import { PanelNode } from '../engine/types';

export interface PanelEntry {
  group: THREE.Group;
  mesh: THREE.Mesh;
  node: PanelNode;
  /** 顺序折叠：全局 fold 到达 phase 后该铰链才开始转，SPAN 内完成 */
  phase: number;
}

/** 顺序折叠参数：铰链旋转窗口宽度 */
const SPAN = 0.26;

/**
 * 铰链折叠时间窗起点（0..1）：按真实成型工序排布
 *   v 折 depth 1（侧壁立起）→ 0.02；depth 2（合拢/包贴）→ 0.14
 *   v 折 depth ≥3（糊口包贴）→ 0.30
 *   h 折 depth 1（摇盖/耳片/底板）→ 0.44 + finalDeg 层序错开
 *   h 折 depth ≥2（插舌）→ 0.74
 * node.phase 显式覆盖：换根后 depth 不再对应成型工序时，由 builder 直接指定
 * 约束：phase + SPAN ≤ 1（fold=1 成型态所有铰链必须完全到位）
 */
function hingePhase(node: PanelNode, depth: number): number {
  if (node.phase !== undefined) return node.phase;
  const h = node.hinge!;
  if (h.kind === 'v') {
    if (depth >= 3) return 0.3;
    return depth <= 1 ? 0.02 : 0.14;
  }
  if (depth >= 2) return 0.74;
  return 0.44 + Math.max(0, (node.finalDeg ?? 90) - 90) * 0.015;
}

/** [a,b] 窗口内的局部进度（0..1，超界截断；fold=1 强制到位） */
function window01(fold: number, phase: number, span: number): number {
  if (fold >= 1) return 1;
  const t = (fold - phase) / span;
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/** 部件组：每棵顶层面板树（多部件盒型的独立部件）一个分组，用于分别贴地 */
export interface PanelRoller {
  group: THREE.Group;
}

/** 3D 模型：根组 + 面板条目 + 每棵顶层树（部件）的部件组 */
export interface PanelModel {
  root: THREE.Group;
  entries: PanelEntry[];
  rollers: PanelRoller[];
}

const BOARD_COLOR = 0xd9c49a; // 牛皮纸板色
const EDGE_COLOR = 0x5f5344;

/** 面板树（含子树）的 2D 包围盒 */
function treeBounds(t: PanelNode) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const walk = (n: PanelNode) => {
    for (const [x, y] of n.poly) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    for (const c of n.children) walk(c);
  };
  walk(t);
  return { minX, maxX, minY, maxY };
}

/** 面板树 → Three.js 对象层级 */
export function buildPanelTreeObject(trees: PanelNode[]): PanelModel {
  const root = new THREE.Group();
  const entries: PanelEntry[] = [];
  const rollers: PanelRoller[] = [];
  const material = new THREE.MeshStandardMaterial({
    color: BOARD_COLOR,
    side: THREE.DoubleSide,
    roughness: 0.88,
    metalness: 0,
  });
  const edgeMat = new THREE.LineBasicMaterial({ color: EDGE_COLOR });

  const add = (node: PanelNode, parent: THREE.Object3D, parentPivot: THREE.Vector3, depth: number) => {
    const g = new THREE.Group();
    // v 折：折线沿世界 z（2D 竖直线 x=at）；h 折：折线沿世界 x（2D 水平线 y=at → z=-at）
    const pivot = new THREE.Vector3(
      node.hinge ? (node.hinge.kind === 'v' ? node.hinge.at : 0) : 0,
      0,
      node.hinge ? (node.hinge.kind === 'h' ? -node.hinge.at : 0) : 0,
    );
    g.position.copy(pivot).sub(parentPivot);
    parent.add(g);

    // 面片：Shape 建在 XY 平面，再 rotateX(-90°) 落到 XZ 水平面：
    // (x, yS, 0) → (x, 0, -yS)，配合 pivot 得世界 3D = (x2d, 0, -y2d)
    // 推导：局部 = 世界 - pivot = (x2d - px, 0, -y2d - pz) → yS = y2d + pz
    const shape = new THREE.Shape(
      node.poly.map(([x, y]) => new THREE.Vector2(x - pivot.x, y + pivot.z)),
    );
    if (node.holes?.length) {
      shape.holes = node.holes.map(
        (h) => new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x - pivot.x, y + pivot.z))),
      );
    }
    const geo = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, material);
    // 边线：提升面片轮廓可读性
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat));
    g.add(mesh);
    entries.push({ group: g, mesh, node, phase: node.hinge ? hingePhase(node, depth) : 0 });

    for (const c of node.children) add(c, g, pivot, depth + 1);
  };

  for (const t of trees) {
    // 每棵顶层树（部件）一个部件组：根面板恒平铺贴地（fold 全程不转），
    // 其余面板绕固定铰链逐波折合，盒子朝向不变、直接折合成平躺姿态
    const b = treeBounds(t);
    const center = new THREE.Vector3((b.minX + b.maxX) / 2, 0, -(b.minY + b.maxY) / 2);
    const roller = new THREE.Group();
    roller.position.copy(center);
    root.add(roller);
    rollers.push({ group: roller });
    add(t, roller, center, 0); // 顶层节点位置相对部件组原点（保持 2D 展开布局）
  }
  return { root, entries, rollers };
}

/**
 * 应用折叠（顺序阶段窗口）
 * @param fold 0..1（0 = 展开平放于地面，1 = 成型平躺）
 * 各铰链在自身 [phase, phase+span] 窗口内完成旋转，形成先后分明的成型动画；
 * 无任何整体翻转——展开/闭合全程盒子朝向保持不变
 */
export function applyFold(model: PanelModel, fold: number) {
  for (const { group, node, phase } of model.entries) {
    if (!node.hinge) continue;
    const local = window01(fold, phase, SPAN);
    const rad = ((node.finalDeg ?? 90) * local * Math.PI) / 180;
    if (node.hinge.kind === 'v') group.rotation.z = -rad * node.hinge.sign;
    else group.rotation.x = -rad * node.hinge.sign;
  }
}

/**
 * 落地锚定：每个部件组独立贴地——包围盒最低点对齐 y=0
 * 折叠每帧调用，保证盒子始终在地平线上方、成型后坐于地面
 * （换根后根面板恒在地面，正常情况下 min.y 已为 0，此函数作防御性校正）
 */
export function groundModel(model: PanelModel): THREE.Box3 {
  model.root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  for (const { group: roller } of model.rollers) {
    let b = new THREE.Box3().setFromObject(roller);
    if (isFinite(b.min.y) && b.min.y !== 0) {
      roller.position.y -= b.min.y;
      roller.updateMatrixWorld(true);
      b = new THREE.Box3().setFromObject(roller);
    }
    box.union(b);
  }
  return box;
}

/** 成型态（已落地）包围盒（相机 fit 用） */
export function foldedBox(model: PanelModel): THREE.Box3 {
  applyFold(model, 1);
  return groundModel(model);
}

/** 释放几何资源 */
export function disposeTree(root: THREE.Group) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[];
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else if (mat) mat.dispose();
  });
}
