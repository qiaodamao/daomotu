import { readFileSync, writeFileSync } from 'node:fs';

const ref = JSON.parse(readFileSync('mod/boite_presentoir.scheme.json', 'utf8'));
const ents = ref.geometry.payload.entities;
const pts = [];
for (const e of ents) if (e.type === 'segment') pts.push([e.x0, e.y0], [e.x1, e.y1]);
else pts.push([e.x0, e.y0], [e.x1, e.y1], [e.cx, e.cy]);
const X = pts.map((p) => p[0]), Y = pts.map((p) => p[1]);
const maxX = Math.max(...X), maxY = Math.max(...Y);
const cx = maxX / 2, cy = (104 + 332) / 2; // 底板带中心

const t = 6, k = t / 3, L = 300, B = 220, H = 100;
const Hf0 = H + 2 * k, Hb = H + k, Lb = L + 8 * k, Bd = B + 4 * k, Ld = B + k, Lt = L + 2 * k;
const bnd = 6 * k, Wi = H - 3 * k, gt = Math.max(4 * k, 5), RT = 20, NR = 65;
const h0 = Lb / 2, h1 = h0 + 3 * k, h2 = h1 + H, h3 = h2 + bnd, h4 = h3 + Wi, h5 = h4 + gt;
const hT = Lt / 2;
const y0 = -(Bd / 2 + Hf0), y1 = -Bd / 2, y2 = -y1, y3 = y2 + Hb, y4 = y3 + Ld, y5 = y4 + Hb, ym = y3 + Ld / 2;
const HF = 44, cutH = Hf0 - HF;
const halfTop = h0 - 10 * k, leftIn = cutH / 3, rightIn = cutH * (17.842 / 60);

const fx = [-h5, -h4, -h3, -h2, -h1, -h0, -(h0 + h1) / 2, -(h1 - 7 * k), -halfTop, -(halfTop - leftIn), -(halfTop - rightIn),
  -hT, -(hT - RT), -NR, 0, NR, hT - RT, hT, h1 - 5 * k, (h0 + h1) / 2, h0, h1, h2, h3, h4, h5, halfTop, halfTop - leftIn, halfTop - rightIn];
const fy = [y0, y0 + 2 * k, y1 - HF, y1 - k, y1, y1 + 2 * k, -Bd / 6, Bd / 6, y2, y2 + k, y3 - 2 * k, y3, ym - NR, ym, y4 - 2 * k, y4, y5 - RT, y5];

const fmt = (v) => Math.round(v * 1000) / 1000;
const near = (list, v) => list.some((u) => Math.abs(u - v) < 0.02);
const uniq = (arr) => [...new Set(arr.map(fmt))].sort((a, b) => a - b);
const out = [];
const rx = uniq(X), ry = uniq(Y);
out.push(`X 参考: ${rx.join(' ')}`);
out.push(`X 公式: ${uniq(fx.map((v) => v + cx)).join(' ')}`);
out.push(`X 未解释: ${rx.filter((v) => !near(fx, v - cx)).join(' ')}`);
out.push(`Y 参考: ${ry.join(' ')}`);
out.push(`Y 公式: ${uniq(fy.map((v) => v + cy)).join(' ')}`);
out.push(`Y 未解释: ${ry.filter((v) => !near(fy, v - cy)).join(' ')}`);
out.push(`幅面 公式 ${2 * h5} × ${y5 - y0}  参考 ${maxX} × ${maxY}`);
out.push(`halfTop=${halfTop} leftIn=${leftIn} rightIn=${rightIn.toFixed(3)} cutH=${cutH}`);
writeFileSync('scratch/derive-bp.txt', out.join('\n') + '\n', 'utf8');
