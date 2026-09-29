/** 临时：把参考 JSON 实体换成 rel 坐标（x-378, y-218）打印，便于人工判读端部结构 */
import fs from 'node:fs';
const j = JSON.parse(fs.readFileSync('mod/boite_presentoir.scheme.json', 'utf8'));
const es: any[] = j.geometry.payload.entities;
const out: string[] = [`entities ${es.length}`];
const R = (v: number) => (Math.round(v * 1000) / 1000).toString().padStart(8);
const rows: string[] = [];
for (const e of es) {
  const lt = e.lineType === 'CUT' ? 'cut  ' : 'crease';
  if (e.type === 'segment') {
    const x0 = e.x0 - 378, y0 = e.y0 - 218, x1 = e.x1 - 378, y1 = e.y1 - 218;
    const kind = Math.abs(y0 - y1) < 0.01 ? 'H' : Math.abs(x0 - x1) < 0.01 ? 'V' : 'D';
    rows.push(`${lt} ${kind} (${R(x0)},${R(y0)}) -> (${R(x1)},${R(y1)})`);
  } else {
    rows.push(`${lt} A c=(${R(e.cx - 378)},${R(e.cy - 218)}) r=${e.radius} a=(${e.angleBeg},${e.angleEnd})`);
  }
}
rows.sort();
out.push(...rows);
fs.writeFileSync('scratch/ref-rel.txt', out.join('\n'));
console.log('ok');
