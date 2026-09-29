import fs from 'node:fs';

const r3 = (v) => Math.round(v * 1000) / 1000;
const file = process.argv[2];
const j = JSON.parse(fs.readFileSync(`mod/${file}.scheme.json`, 'utf8'));
const p = j.geometry.payload;
const out = [];
out.push(`== ${file} ${j.description} bounds=${JSON.stringify(p.bounds)} n=${p.entities.length}`);
out.push('params: ' + (j.parameters || []).map((x) => `${x.name}=${x.value}`).join(' '));

const segs = p.entities.filter((e) => e.type === 'segment');
const arcs = p.entities.filter((e) => e.type === 'arc');
out.push(`counts: seg=${segs.length} arc=${arcs.length} cut=${p.entities.filter((e) => e.lineType === 'CUT').length} crease=${p.entities.filter((e) => e.lineType === 'CREASING').length}`);
out.push('arc radii: ' + [...new Set(arcs.map((a) => r3(a.radius)))].sort((a, b) => a - b).join(' '));

const xs = new Map();
const ys = new Map();
const add = (m, v) => m.set(r3(v), (m.get(r3(v)) || 0) + 1);
for (const e of p.entities) {
  if (e.type === 'segment') { add(xs, e.x0); add(ys, e.y0); add(xs, e.x1); add(ys, e.y1); }
  else { add(xs, e.cx); add(ys, e.cy); add(xs, e.x0); add(ys, e.y0); add(xs, e.x1); add(ys, e.y1); }
}
out.push('X values: ' + [...xs.keys()].sort((a, b) => a - b).join(' '));
out.push('Y values: ' + [...ys.keys()].sort((a, b) => a - b).join(' '));

out.push('--- entities (order)');
p.entities.forEach((e, i) => {
  if (e.type === 'segment') {
    out.push(`${i} ${e.lineType[0]} SEG (${r3(e.x0)},${r3(e.y0)})->(${r3(e.x1)},${r3(e.y1)})`);
  } else {
    out.push(
      `${i} ${e.lineType[0]} ARC c=(${r3(e.cx)},${r3(e.cy)}) r=${r3(e.radius)} a=[${r3(e.angleBeg)},${r3(e.angleEnd)}] (${r3(e.x0)},${r3(e.y0)})->(${r3(e.x1)},${r3(e.y1)})`
    );
  }
});
fs.writeFileSync(`analyze-${file}.txt`, out.join('\n'));
console.log('written');
