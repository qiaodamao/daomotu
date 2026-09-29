import { readFileSync, writeFileSync } from 'node:fs';

const ref = JSON.parse(readFileSync('mod/Patisserie_box_06.scheme.json', 'utf8'));
const ents = ref.geometry.payload.entities;
const out = [];
// 逐实体打印相对坐标（原点 = 底板中心 (194,256)）
const C = { x: 194, y: 256 };
ents.forEach((e, i) => {
  if (e.type === 'segment') {
    out.push(`${i} ${e.lineType === 'CUT' ? 'c' : 'C'} (${(e.x0 - C.x).toFixed(3)},${(e.y0 - C.y).toFixed(3)})->(${(e.x1 - C.x).toFixed(3)},${(e.y1 - C.y).toFixed(3)})`);
  } else {
    const P = (px, py) => {
      const a = (Math.atan2(py - e.cy, px - e.cx) * 180) / Math.PI;
      return ((a % 360) + 360) % 360;
    };
    const a0 = P(e.x0, e.y0), a1 = P(e.x1, e.y1);
    out.push(`${i} ${e.lineType === 'CUT' ? 'c' : 'C'} ARC c=(${(e.cx - C.x).toFixed(3)},${(e.cy - C.y).toFixed(3)}) r=${e.radius} [${a0.toFixed(3)},${a1.toFixed(3)}] json=[${e.angleBeg},${e.angleEnd}]`);
  }
});
writeFileSync('scratch/rel-pat.txt', out.join('\n') + '\n', 'utf8');

// 系数拟合：以 L=200 B=120 H=80 t=2 为基准，检查一组常量
const L = 200, B = 120, H = 80, t = 2;
const cands = {
  'Lb=L+20': L + 20, 'e=t': t, 'Hf=H+8': H + 8, 'Hb=H+7': H + 7, 'wall=H-4': H - 4,
  'flap=H+2': H + 2, 'lid=B+4': B + 4, 'tuck=H+3': H + 3, 'step=6': 3 * t, 'fil=3': 1.5 * t,
  'slot=12': 6 * t, 'tabW=40': 20 * t, 'tabH=3': 1.5 * t, 'R=10': 5 * t, 'in9': 4.5 * t, 'in7': 3.5 * t,
  'earY=55': 27.5 * t, 'earX=6': 3 * t, 'notch=26': 13 * t,
};
const lines = [];
for (const [k, v] of Object.entries(cands)) lines.push(`${k}=${v}`);
writeFileSync('scratch/fit-pat.txt', lines.join('\n') + '\n', 'utf8');
