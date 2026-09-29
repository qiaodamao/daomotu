/** 参考刀版逆向分析：打印端点表 + 坐标直方图（临时脚本，勿提交） */
import fs from 'node:fs';

const file = process.argv[2] || 'boite_presentoir';
const j = JSON.parse(fs.readFileSync(`mod/${file}.scheme.json`, 'utf8'));
const p = j.geometry.payload;
const rp = j.parameters || [];
const out = [];
out.push(`== ${file} | ${j.description} | n=${p.entities.length} | bounds=${JSON.stringify(p.bounds)}`);
out.push('params: ' + rp.map((x) => `${x.name}=${x.value}${x.role ? `(${x.role})` : ''}`).join(' '));

const r3 = (v) => Math.round(v * 1000) / 1000;
const xs = new Map();
const ys = new Map();
const bump = (m, v) => m.set(r3(v), (m.get(r3(v)) || 0) + 1);

p.entities.forEach((e, i) => {
  if (e.type === 'segment') {
    bump(xs, e.x0); bump(xs, e.x1); bump(ys, e.y0); bump(ys, e.y1);
    out.push(`${String(i).padStart(3)} ${e.lineType === 'CUT' ? 'CUT' : 'CRE'} SEG (${r3(e.x0)},${r3(e.y0)}) -> (${r3(e.x1)},${r3(e.y1)})  len=${r3(Math.hypot(e.x1 - e.x0, e.y1 - e.y0))}`);
  } else {
    bump(xs, e.cx); bump(ys, e.cy); bump(xs, e.x0); bump(ys, e.y0); bump(xs, e.x1); bump(ys, e.y1);
    out.push(`${String(i).padStart(3)} ${e.lineType === 'CUT' ? 'CUT' : 'CRE'} ARC c=(${r3(e.cx)},${r3(e.cy)}) r=${r3(e.radius)} a=[${r3(e.angleBeg)},${r3(e.angleEnd)}] (${r3(e.x0)},${r3(e.y0)}) -> (${r3(e.x1)},${r3(e.y1)})`);
  }
});
out.push('--- X histogram: ' + [...xs.keys()].sort((a, b) => a - b).map((v) => `${v}(${xs.get(v)})`).join(' '));
out.push('--- Y histogram: ' + [...ys.keys()].sort((a, b) => a - b).map((v) => `${v}(${ys.get(v)})`).join(' '));

// 长度直方图（水平/竖直线段的长度分布，便于反推公式）
const lens = new Map();
for (const e of p.entities) {
  if (e.type !== 'segment') continue;
  if (Math.abs(e.y0 - e.y1) < 1e-6) bump(lens, Math.abs(e.x1 - e.x0));
  else if (Math.abs(e.x0 - e.x1) < 1e-6) bump(lens, Math.abs(e.y1 - e.y0));
}
out.push('--- 水平/竖直线段长度: ' + [...lens.keys()].sort((a, b) => a - b).map((v) => `${v}(${lens.get(v)})`).join(' '));
out.push('--- 斜线段: ' + p.entities.filter((e) => e.type === 'segment' && Math.abs(e.y0 - e.y1) > 1e-6 && Math.abs(e.x0 - e.x1) > 1e-6).map((e, i) => `${r3(e.x0)},${r3(e.y0)}->${r3(e.x1)},${r3(e.y1)}(d=${r3(e.x1 - e.x0)},${r3(e.y1 - e.y0)})`).join(' '));

fs.writeFileSync(`scratch/nodes-${file}.txt`, out.join('\n'));
console.log(`-> scratch/nodes-${file}.txt (${p.entities.length} entities)`);
