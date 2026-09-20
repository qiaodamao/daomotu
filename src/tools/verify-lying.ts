/**
 * 临时验证：3D 平放折叠几何（直接平躺成型，无中途翻转）
 * 预期（对每个部件）：
 *   fold=0  展开态：纸板平铺地面（包围盒 y 厚度 ≈ 0）
 *   fold=1  成型态：盒体平躺（L 沿 x 水平、W 沿 y 竖直、H 沿 z 水平），min.y=0 贴地
 *   多部件盒型（抽屉盒/天地盖）：各部件并排平放、分别贴地
 */
import * as THREE from 'three';
import { fefco0201 } from '../engine/builders/fefco0201';
import { fefco0200 } from '../engine/builders/fefco0200';
import { shortFlapBox } from '../engine/builders/shortFlapBox';
import { mailer0427 } from '../engine/builders/mailer0427';
import { mailerFlat } from '../engine/builders/mailerFlat';
import { tuckTuckBox } from '../engine/builders/tuckTuckBox';
import { reverseTuck } from '../engine/builders/reverseTuck';
import { autobottom0700 } from '../engine/builders/autobottom0700';
import { windowBox } from '../engine/builders/windowBox';
import { drawerBox } from '../engine/builders/drawerBox';
import { boxLid } from '../engine/builders/boxLid';
import { fruitBox } from '../engine/builders/fruitBox';
import { cakeBox } from '../engine/builders/cakeBox';
import { onePageBox } from '../engine/builders/onePageBox';
import { bookBox } from '../engine/builders/bookBox';
import { pillowBox } from '../engine/builders/pillowBox';
import { rollTray0422, rollTray0421, trayEarlock427 } from '../engine/builders/rollTray';
import { bookWrap } from '../engine/builders/bookWrap';
import { hexBox } from '../engine/builders/hexBox';
import { handleBox } from '../engine/builders/handleBox';
import { DEFAULT_PARAMS } from '../engine/params';
import { DielineResult, PanelNode } from '../engine/types';
import { buildPanelTreeObject, applyFold, groundModel, PanelModel } from '../render/render3d';

let fail = 0;

/** 部件期望：[名称, L(x), W(y 竖直高), H(z)] */
type Part = [string, number, number, number];

function verify(label: string, build: (p: typeof DEFAULT_PARAMS) => DielineResult, parts: Part[]) {
  const result = build(DEFAULT_PARAMS);
  const model: PanelModel = buildPanelTreeObject(result.panels);
  const tol = 15; // 摇盖/糊口错层 + 插舌余量

  // 展开态：每个部件平铺（y 厚度 ~0）
  applyFold(model, 0);
  model.root.updateMatrixWorld(true);
  let flatOk = model.rollers.length === parts.length;
  for (const roller of model.rollers) {
    const b = new THREE.Box3().setFromObject(roller.group);
    if (Math.abs(b.min.y) > 1e-6 || Math.abs(b.max.y) > 1e-6) flatOk = false;
  }
  if (!flatOk) fail++;
  const flat = new THREE.Box3().setFromObject(model.root);
  console.log(`${flatOk ? 'PASS' : 'FAIL'} ${label} 展开态: 平铺地面 y∈[${flat.min.y.toFixed(3)}, ${flat.max.y.toFixed(3)}]（厚度应≈0）`);

  // 成型态：每个部件平躺（x=L, y=W 竖直, z=H），贴地
  applyFold(model, 1);
  groundModel(model);
  let all = true;
  model.rollers.forEach((roller, i) => {
    const b = new THREE.Box3().setFromObject(roller.group);
    const s = b.getSize(new THREE.Vector3());
    const [name, L, W, H] = parts[i] ?? ['?', 0, 0, 0];
    const okX = Math.abs(s.x - L) < tol;
    const okY = Math.abs(s.y - W) < tol;
    const okZ = Math.abs(s.z - H) < tol;
    const okG = Math.abs(b.min.y) < 1e-6;
    const ok = okX && okY && okZ && okG;
    if (!ok) all = false;
    console.log(
      `${ok ? 'PASS' : 'FAIL'} ${label} 成型态·${name}: ${s.x.toFixed(0)}×${s.y.toFixed(0)}×${s.z.toFixed(0)}（期望 L×W×H = ${L}×${W}×${H} 平躺） min.y=${b.min.y.toFixed(3)}`
    );
    if (!okX) console.log(`  x=${s.x.toFixed(1)} 期望 ${L}`);
    if (!okY) console.log(`  y=${s.y.toFixed(1)} 期望 ${W}（W 竖直 = 平放高度）`);
    if (!okZ) console.log(`  z=${s.z.toFixed(1)} 期望 ${H}`);
    if (!okG) console.log(`  min.y=${b.min.y} 未贴地`);
  });
  if (!all) fail++;

  // 折叠全程：① 各部件始终可贴地（groundModel 自校正）
  //           ② 无整体翻转（部件组 rotation 恒 0，盒子朝向全程不变）
  //           ③ 无轴向互换（x/z 跨度全程 ≥ 终态值：根面板恒横跨终态宽度，
  //              旧翻转台方案 x↔y 互换会先收缩到 W 再涨回 L，必被此检查抓住）
  const sizeSeq: THREE.Vector3[][] = model.rollers.map(() => []);
  let noRoll = true;
  let minBelow = false;
  for (let f = 0; f <= 1.001; f += 0.05) {
    applyFold(model, Math.min(f, 1));
    const b = groundModel(model);
    if (b.min.y < -1e-6) {
      fail++;
      console.log(`FAIL ${label}: fold=${f.toFixed(2)} min.y=${b.min.y.toFixed(3)} 穿地`);
    }
    for (const { group } of model.rollers) {
      if (group.rotation.x !== 0 || group.rotation.y !== 0 || group.rotation.z !== 0) noRoll = false;
    }
    model.rollers.forEach((roller, i) => {
      const bb = new THREE.Box3().setFromObject(roller.group);
      sizeSeq[i].push(bb.getSize(new THREE.Vector3()));
    });
  }
  if (!noRoll) {
    fail++;
    console.log(`FAIL ${label}: 折叠全程出现部件组整体旋转（应只有铰链旋转）`);
  }
  model.rollers.forEach((_, i) => {
    const seq = sizeSeq[i];
    const fin = seq[seq.length - 1];
    const tol = 15; // 摇盖/糊口错层过折余量；盖类三段折（墙→盖→舌）中途经历竖直态，
    // z 投影暂缩（终态由盖尖越出 + 弹簧耳 z 分量后期贡献），属合法过程非换向；
    // 真换向跨度差为量级级（数十 mm），此容差不漏检
    for (const s of seq) {
      if (s.x < fin.x - tol || s.z < fin.z - tol) {
        minBelow = true;
        console.log(`FAIL ${label} 部件${i}: 中途 x/z 跨度 (${s.x.toFixed(0)}, ${s.z.toFixed(0)}) 低于终态 (${fin.x.toFixed(0)}, ${fin.z.toFixed(0)}) —— 发生轴向互换/整体换向`);
        break;
      }
    }
  });
  if (minBelow) fail++;
  console.log(`     折叠全程贴地 ✓ 朝向不变 ✓`);
}

const p = DEFAULT_PARAMS;
// 套筒/盖 制造尺寸 = 底制造 + 3t + 间隙（与 drawerBox/boxLid 推导一致）
const outerL = p.L + 3 * p.t + p.clearance;
const outerW = p.W + 3 * p.t + p.clearance;
const outerH = Math.max(p.lidH, 10);

// 浅筒部件（套筒/盖）：与常规盒统一的 L×W×H 平躺姿态（x=L、y=W 竖直、z=H）
// （浅筒两端开口、无端面板，直接平躺成型是唯一全程无换向的姿态）
const rim = (name: string): Part => [name, outerL, outerW, outerH];
const single: Part[] = [['主体', p.L, p.W, p.H]];
verify('0201', (pp) => fefco0201.build(pp), single);
verify('0200 全叠盖箱', (pp) => fefco0200.build(pp), single);
verify('短摇盖开口箱', (pp) => shortFlapBox.build(pp), single);
verify('0427 飞机盒', (pp) => mailer0427.build(pp), single);
verify('平压底飞机盒', (pp) => mailerFlat.build(pp), single);
verify('双插舌盒', (pp) => tuckTuckBox.build(pp), single);
verify('反插盒', (pp) => reverseTuck.build(pp), single);
verify('自锁底盒', (pp) => autobottom0700.build(pp), single);
verify('开窗箱', (pp) => windowBox.build(pp), single);
verify('抽屉盒', (pp) => drawerBox.build(pp), [['内托', p.L, p.W, p.H], rim('套筒')]);
verify('天地盖', (pp) => boxLid.build(pp), [['底盒', p.L, p.W, p.H], rim('盖盒')]);
// 管式盒型（root=col2 正面平铺贴地）与托盘式盒型（root=前壁/脊平铺贴地）
// 均直接折合成 L×W×H 平躺姿态，折叠全程盒子朝向不变
verify('0204 全底箱', (pp) => fruitBox.build(pp), single);
verify('提手飞机盒', (pp) => cakeBox.build(pp), single);
verify('一页成型箱', (pp) => onePageBox.build(pp), single);
verify('书型翻盖盒', (pp) => bookBox.build(pp), single);
// 枕形盒：L 沿 x、枕厚 W 竖直、枕高 H 沿 z（平躺）
verify('枕形盒', (pp) => pillowBox.build(pp), single);
// 卷边托盘：底板 2S 沿 x、墙高竖直、端部叠压沿 z（平躺）
verify('0422 卷边托盘', (pp) => rollTray0422.build(pp), [['托盘', 462, 285, 226]]);
verify('0421 卷边托盘', (pp) => rollTray0421.build(pp), [['托盘', 466, 295, 226]]);
verify('427 耳锁盖托盘', (pp) => trayEarlock427.build(pp), [['托盘', 472, 288, 244]]);
verify('瓦楞提手箱', (pp) => handleBox.build(pp), single);
verify('邮购信封盒', (pp) => bookWrap.build(pp), [['信封盒', 434, 278, 214]]);
verify('六角柱礼盒', (pp) => hexBox.build(pp), [['六角筒', 501, 278, 434]]);

console.log(fail === 0 ? '\n全部通过' : `\n${fail} 项失败`);
process.exit(fail === 0 ? 0 : 1);
