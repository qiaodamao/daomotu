/** 几何引擎自验（构建期检查，非产品代码） */
import { DEFAULT_PARAMS } from '../engine/params';
import { REGISTRY } from '../engine/registry';

let fail = 0;
function check(name: string, got: number, want: number, tol = 0.01) {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: got=${got} want=${want}`);
}

for (const b of REGISTRY) {
  const r = b.build({ ...DEFAULT_PARAMS });
  console.log(`\n== ${b.name} == entities=${r.entities.length} unfold=${r.meta.unfold.w.toFixed(1)}x${r.meta.unfold.h.toFixed(1)} warnings=${r.meta.warnings.length}`);
}

// 0201 数值对标（B楞 t=3，制造 434x214x278，糊口30 开槽7）
const p = { ...DEFAULT_PARAMS };
const r0201 = REGISTRY[0].build(p);
check('0201 展开总宽', r0201.meta.unfold.w, 2 * 434 + 2 * 214 + 30); // 1326
check('0201 展开总高', r0201.meta.unfold.h, 278 + 2 * 107); // 492（竞品 sff 同参数输出 492）
check('0201 摇盖', r0201.meta.flaps!.f1, 107);

// 换算：内尺寸 → 制造
const rInner = REGISTRY[0].build({ ...p, sizeType: 'inner', L: 431, W: 211, H: 272 });
check('内→制造长', rInner.meta.makeSize.l, 434);

// 天地盖：盖制造 = 底制造 + 3t + clearance
const rLid = REGISTRY.find((b) => b.id === 'box-lid')!.build(p);
console.log(`天地盖 底=${rLid.meta.makeSize.l}x${rLid.meta.makeSize.w}x${rLid.meta.makeSize.h} 毛面积=${rLid.meta.areaM2}`);

if (fail) {
  console.error(`\n${fail} 项失败`);
  process.exit(1);
}
console.log('\n全部通过');
