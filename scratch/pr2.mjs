import { readFileSync, writeFileSync } from 'node:fs';
const ref = JSON.parse(readFileSync('mod/Patisserie_box_06.scheme.json', 'utf8'));
const ents = ref.geometry.payload.entities;
const out = [];
const cx = 194, cy = 256;
const rx = (v) => v - cx, ry = (v) => v - cy;
out.push('== VERT x=abs rel | segments ==');
const xs = new Map(), ys = new Map();
ents.forEach((e, i) => {
  if (e.type !== 'segment') return;
  const cut = e.lineType === 'CUT' ? 'c' : 'C';
  if (Math.abs(e.x0 - e.x1) < 1e-9) {
    const k = +e.x0.toFixed(2);
    if (!xs.has(k)) xs.set(k, []);
    xs.get(k).push(`${i}${cut} ${ry(e.y0).toFixed(2)}..${ry(e.y1).toFixed(2)} L${Math.abs(e.y1 - e.y0).toFixed(2)}`);
  }
  if (Math.abs(e.y0 - e.y1) < 1e-9) {
    const k = +e.y0.toFixed(2);
    if (!ys.has(k)) ys.set(k, []);
    ys.get(k).push(`${i}${cut} ${rx(e.x0).toFixed(2)}..${rx(e.x1).toFixed(2)} L${Math.abs(e.x1 - e.x0).toFixed(2)}`);
  }
});
[...xs.keys()].sort((a, b) => a - b).forEach((x) => out.push(`x=${x} rel=${rx(x).toFixed(2)} | ${xs.get(x).join(' | ')}`));
out.push('== HORZ y=abs rel | segments ==');
[...ys.keys()].sort((a, b) => a - b).forEach((y) => out.push(`y=${y} rel=${ry(y).toFixed(2)} | ${ys.get(y).join(' | ')}`));
out.push('== DIAG (rel coords, slope deg) ==');
ents.forEach((e, i) => {
  if (e.type !== 'segment') return;
  if (Math.abs(e.x0 - e.x1) < 1e-9 || Math.abs(e.y0 - e.y1) < 1e-9) return;
  const dx = e.x1 - e.x0, dy = e.y1 - e.y0;
  out.push(`${i}${e.lineType === 'CUT' ? 'c' : 'C'} (${rx(e.x0).toFixed(3)},${ry(e.y0).toFixed(3)})->(${rx(e.x1).toFixed(3)},${ry(e.y1).toFixed(3)}) L=${Math.hypot(dx, dy).toFixed(3)} ang=${((Math.atan2(dy, dx) * 180) / Math.PI).toFixed(3)}`);
});
out.push('== ARC ==');
ents.forEach((e, i) => {
  if (e.type !== 'arc') return;
  const A = (px, py) => ((Math.atan2(py - e.cy, px - e.cx) * 180) / Math.PI + 360) % 360;
  out.push(`${i}${e.lineType === 'CUT' ? 'c' : 'C'} c=(${rx(e.cx).toFixed(3)},${ry(e.cy).toFixed(3)}) r=${e.radius.toFixed(3)} json[${e.angleBeg.toFixed(3)},${e.angleEnd.toFixed(3)}] ep[${A(e.x0, e.y0).toFixed(3)},${A(e.x1, e.y1).toFixed(3)}] A=(${rx(e.x0).toFixed(3)},${ry(e.y0).toFixed(3)}) B=(${rx(e.x1).toFixed(3)},${ry(e.y1).toFixed(3)})`);
});
writeFileSync('scratch/pat-rel.txt', out.join('\n') + '\n', 'utf8');
