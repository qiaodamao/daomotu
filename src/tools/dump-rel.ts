/** 临时：把生成器输出按参考同款坐标（y 向下，未平移）打印，便于逐线核对 */
import fs from "node:fs";
import { REGISTRY, boxDefaults } from '../engine/registry';
import { BoxParams } from '../engine/params';

const boxId = process.argv[2] ?? 'patisserie-display';
const jsonPath = process.argv[3];
const box = REGISTRY.find((b) => b.id === boxId)!;
let params: BoxParams = { ...boxDefaults(boxId) };
if (jsonPath) {
  const ref = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const rp = (ref.parameters ?? []) as { name: string; value: number; role: string | null }[];
  const num = (role: string, fb: number) => rp.find((x) => x.role === role)?.value ?? fb;
  params = { ...params, L: num('length', params.L), W: num('width', params.W), H: num('height', params.H), t: num('thickness', params.t) };
}
const mine = box.build(params);
const out: string[] = [];
const xs = new Map<number, string[]>();
const ys = new Map<number, string[]>();
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
const eat = (x: number, y: number) => { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; };
const pt = (cx: number, cy: number, r: number, deg: number) => ({ x: cx + r * Math.cos((deg * Math.PI) / 180), y: cy + r * Math.sin((deg * Math.PI) / 180) });
mine.entities.forEach((e, i) => {
  const cut = e.layer === 'cut' ? 'c' : 'C';
  let a = { x: 0, y: 0 }, b = { x: 0, y: 0 };
  if (e.kind === 'line') { a = e.a; b = e.b; }
  else if (e.kind === 'arc') { a = pt(e.c.x, e.c.y, e.r, e.a0); b = pt(e.c.x, e.c.y, e.r, e.a1); eat(e.c.x - e.r, e.c.y - e.r); eat(e.c.x + e.r, e.c.y + e.r); }
  else { eat(e.c.x - e.r, e.c.y - e.r); eat(e.c.x + e.r, e.c.y + e.r); return; }
  eat(a.x, a.y); eat(b.x, b.y);
  if (Math.abs(a.x - b.x) < 1e-9) {
    const k = +a.x.toFixed(2);
    if (!xs.has(k)) xs.set(k, []);
    xs.get(k)!.push(`${i}${cut} ${a.y.toFixed(2)}..${b.y.toFixed(2)} L${Math.abs(b.y - a.y).toFixed(2)}`);
  }
  if (Math.abs(a.y - b.y) < 1e-9) {
    const k = +a.y.toFixed(2);
    if (!ys.has(k)) ys.set(k, []);
    ys.get(k)!.push(`${i}${cut} ${a.x.toFixed(2)}..${b.x.toFixed(2)} L${Math.abs(b.x - a.x).toFixed(2)}`);
  }
});
out.push(`params L=${params.L} W=${params.W} H=${params.H} t=${params.t} sizeType=${params.sizeType}`);
out.push(`bbox x ${minX.toFixed(3)}..${maxX.toFixed(3)} (${(maxX - minX).toFixed(3)})  y ${minY.toFixed(3)}..${maxY.toFixed(3)} (${(maxY - minY).toFixed(3)})  n=${mine.entities.length}`);
out.push('== VERT x | segs ==');
[...xs.entries()].sort((p, q) => p[0] - q[0]).forEach(([k, v]) => out.push(`x=${k.toFixed(2)} | ${v.join(' | ')}`));
out.push('== HORZ y | segs ==');
[...ys.entries()].sort((p, q) => p[0] - q[0]).forEach(([k, v]) => out.push(`y=${k.toFixed(2)} | ${v.join(' | ')}`));
out.push('== OTHER (diagonal / arc) ==');
mine.entities.forEach((e, i) => {
  if (e.kind === 'arc') out.push(`${i}${e.layer === 'cut' ? 'c' : 'C'} arc c=(${e.c.x.toFixed(3)},${e.c.y.toFixed(3)}) r=${e.r.toFixed(3)} [${e.a0.toFixed(3)},${e.a1.toFixed(3)}] A=${JSON.stringify(pt(e.c.x, e.c.y, e.r, e.a0))} B=${JSON.stringify(pt(e.c.x, e.c.y, e.r, e.a1))}`);
  else if (e.kind === 'line' && Math.abs(e.a.x - e.b.x) > 1e-9 && Math.abs(e.a.y - e.b.y) > 1e-9) out.push(`${i}${e.layer === 'cut' ? 'c' : 'C'} seg (${e.a.x.toFixed(3)},${e.a.y.toFixed(3)})->(${e.b.x.toFixed(3)},${e.b.y.toFixed(3)}) L=${Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y).toFixed(3)}`);
});
fs.writeFileSync('scratch/mine-rel.txt', out.join('\n'));
console.log('ok', mine.entities.length);
