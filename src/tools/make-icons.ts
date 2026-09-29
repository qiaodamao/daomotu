/**
 * 从 public/logo.png 生成全部站点图标（无第三方依赖）：
 *   public/favicon.ico                     浏览器标签页（16/24/32/48 BMP + 64/128/256 PNG）
 *   public/icons/icon-{192,512}.png         manifest 普通图标（保留透明边）
 *   public/icons/maskable-{192,512}.png     安卓自适应图标（实色底 + 图形缩进安全区，避免被圆形裁掉）
 * 换 logo 后重跑：npx tsx src/tools/make-icons.ts
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { inflateSync, deflateSync, crc32 } from 'node:zlib';

type Img = { w: number; h: number; px: Uint8Array }; // RGBA, 非预乘

const SRC = 'public/logo.png';
const OUT_DIRS = ['public', 'dist'];
const BMP_SIZES = [16, 24, 32, 48];
const PNG_SIZES = [64, 128, 256];
const ICON_SIZES = [192, 512];
// 自适应图标：底色用站点主色（近黑），图形按"内容离中心最远的像素"缩进安全圆
// 启动器 108dp 画布的 66dp 安全圆 → 半径占画布 30.6%
const MASKABLE_BG: [number, number, number] = [23, 23, 23];
const SAFE_RADIUS_RATIO = 0.306;

function decodePng(buf: Buffer): Img {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('不是 PNG 文件');
  let w = 0;
  let h = 0;
  let bd = 0;
  let ct = 0;
  const idat: Buffer[] = [];
  let o = 8;
  while (o < buf.length) {
    const len = buf.readUInt32BE(o);
    const type = buf.slice(o + 4, o + 8).toString('latin1');
    const body = buf.slice(o + 8, o + 8 + len);
    if (type === 'IHDR') {
      w = body.readUInt32BE(0);
      h = body.readUInt32BE(4);
      bd = body[8];
      ct = body[9];
      if (bd !== 8 || ct !== 6) throw new Error(`只支持 8bit RGBA PNG，当前 bd=${bd} ct=${ct}`);
    } else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    o += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * 4;
  const px = new Uint8Array(w * h * 4);
  const paeth = (a: number, b: number, c: number) => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    const line = y * stride;
    const prev = (y - 1) * stride;
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const a = x >= 4 ? px[line + x - 4] : 0;
      const b = y > 0 ? px[prev + x] : 0;
      const c = x >= 4 && y > 0 ? px[prev + x - 4] : 0;
      const sum =
        ft === 0 ? v : ft === 1 ? v + a : ft === 2 ? v + b : ft === 3 ? v + ((a + b) >> 1) : v + paeth(a, b, c);
      px[line + x] = sum & 255;
    }
  }
  return { w, h, px };
}

// 含 alpha 的面积平均缩小（透明像素不贡献颜色，否则小尺寸发灰）
function areaScale(src: Img, dw: number, dh: number): Img {
  const out = new Uint8Array(dw * dh * 4);
  for (let dy = 0; dy < dh; dy++) {
    const y0 = Math.floor((dy * src.h) / dh);
    const y1 = Math.max(y0 + 1, Math.ceil(((dy + 1) * src.h) / dh));
    for (let dx = 0; dx < dw; dx++) {
      const x0 = Math.floor((dx * src.w) / dw);
      const x1 = Math.max(x0 + 1, Math.ceil(((dx + 1) * src.w) / dw));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * src.w + x) * 4;
          const al = src.px[i + 3];
          r += (src.px[i] * al) / 255;
          g += (src.px[i + 1] * al) / 255;
          b += (src.px[i + 2] * al) / 255;
          a += al;
          n++;
        }
      }
      const o = (dy * dw + dx) * 4;
      const alpha = a / n;
      out[o + 3] = Math.round(alpha);
      out[o] = alpha > 0 ? Math.min(255, Math.round((r / n) * (255 / alpha))) : 0;
      out[o + 1] = alpha > 0 ? Math.min(255, Math.round((g / n) * (255 / alpha))) : 0;
      out[o + 2] = alpha > 0 ? Math.min(255, Math.round((b / n) * (255 / alpha))) : 0;
    }
  }
  return { w: dw, h: dh, px: out };
}

// 不透明内容的范围：bbox + 中心 + "离中心最远的不透明像素"半径
function contentMetrics(src: Img) {
  let x0 = src.w;
  let y0 = src.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      if (src.px[(y * src.w + x) * 4 + 3] > 10) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) throw new Error('logo.png 全透明');
  const cx = (x0 + x1 + 1) / 2;
  const cy = (y0 + y1 + 1) / 2;
  let r = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (src.px[(y * src.w + x) * 4 + 3] > 10) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d > r) r = d;
      }
    }
  }
  return { x0, y0, x1, y1, cx, cy, r };
}

// 实色底 + 居中贴图
function compose(size: number, bg: [number, number, number], overlay: Img, cx: number, cy: number): Img {
  const px = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    px[i * 4] = bg[0];
    px[i * 4 + 1] = bg[1];
    px[i * 4 + 2] = bg[2];
    px[i * 4 + 3] = 255;
  }
  const ox = Math.round(cx - overlay.w / 2);
  const oy = Math.round(cy - overlay.h / 2);
  for (let y = 0; y < overlay.h; y++) {
    const ty = oy + y;
    if (ty < 0 || ty >= size) continue;
    for (let x = 0; x < overlay.w; x++) {
      const tx = ox + x;
      if (tx < 0 || tx >= size) continue;
      const s = (y * overlay.w + x) * 4;
      const al = overlay.px[s + 3] / 255;
      const t = (ty * size + tx) * 4;
      for (let k = 0; k < 3; k++) px[t + k] = Math.round(overlay.px[s + k] * al + px[t + k] * (1 - al));
      px[t + 3] = 255;
    }
  }
  return { w: size, h: size, px };
}

function chunk(type: string, body: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'latin1'), body])) as number, 0);
  return Buffer.concat([head, body, crc]);
}

function encodePng(img: Img): Buffer {
  const stride = img.w * 4;
  const raw = Buffer.alloc((stride + 1) * img.h); // 每行首字节 = filter type 0
  for (let y = 0; y < img.h; y++) raw.set(img.px.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.w, 0);
  ihdr.writeUInt32BE(img.h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ICO 里的 BMP 载荷：BITMAPINFOHEADER（高度两倍：XOR + AND）+ BGRA 自底向上 + 1bit AND 掩码
function encodeIcoBmp(img: Img): Buffer {
  const maskRow = Math.ceil(img.w / 32) * 4;
  const bih = Buffer.alloc(40);
  bih.writeUInt32LE(40, 0);
  bih.writeInt32LE(img.w, 4);
  bih.writeInt32LE(img.h * 2, 8);
  bih.writeUInt16LE(1, 12);
  bih.writeUInt16LE(32, 14);
  const xor = Buffer.alloc(img.w * img.h * 4);
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      const s = (y * img.w + x) * 4;
      const t = ((img.h - 1 - y) * img.w + x) * 4;
      xor[t] = img.px[s + 2];
      xor[t + 1] = img.px[s + 1];
      xor[t + 2] = img.px[s];
      xor[t + 3] = img.px[s + 3];
    }
  }
  const and = Buffer.alloc(maskRow * img.h);
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      if (img.px[(y * img.w + x) * 4 + 3] < 128) and[y * maskRow + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  bih.writeUInt32LE(xor.length + and.length, 20);
  return Buffer.concat([bih, xor, and]);
}

function buildIco(entries: { size: number; data: Buffer }[]): Buffer {
  const dir = Buffer.alloc(entries.length * 16);
  let offset = 6 + entries.length * 16;
  entries.forEach((e, i) => {
    const p = dir.slice(i * 16, i * 16 + 16);
    p.writeUInt8(e.size >= 256 ? 0 : e.size, 0);
    p.writeUInt8(e.size >= 256 ? 0 : e.size, 1);
    p.writeUInt16LE(1, 4);
    p.writeUInt16LE(32, 6);
    p.writeUInt32LE(e.data.length, 8);
    p.writeUInt32LE(offset, 12);
    offset += e.data.length;
  });
  const head = Buffer.alloc(6);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(entries.length, 4);
  return Buffer.concat([head, dir, ...entries.map((e) => e.data)]);
}

const src = decodePng(readFileSync(SRC));
const m = contentMetrics(src);

const ico = buildIco([
  ...BMP_SIZES.map((s) => ({ size: s, data: encodeIcoBmp(areaScale(src, s, s)) })),
  ...PNG_SIZES.map((s) => ({ size: s, data: encodePng(areaScale(src, s, s)) })),
]);

const files: { path: string; data: Buffer }[] = [];
const maskableStats: string[] = [];
for (const dir of OUT_DIRS) files.push({ path: `${dir}/favicon.ico`, data: ico });
for (const size of ICON_SIZES) {
  const anyIcon = encodePng(areaScale(src, size, size));
  files.push(
    { path: `public/icons/icon-${size}.png`, data: anyIcon },
    { path: `dist/icons/icon-${size}.png`, data: anyIcon }
  );
  // 把"离中心最远的不透明像素"缩放到刚好落在安全圆内
  const k = (SAFE_RADIUS_RATIO * size) / m.r;
  const dw = Math.max(1, Math.round(src.w * k));
  const dh = Math.max(1, Math.round(src.h * k));
  const overlay = areaScale(src, dw, dh);
  // compose 摆放的是贴图中心，所以要抵消内容中心与贴图中心的偏移
  const tx = size / 2 + (dw / 2 - m.cx * k);
  const ty = size / 2 + (dh / 2 - m.cy * k);
  const maskable = encodePng(compose(size, MASKABLE_BG, overlay, tx, ty));
  files.push(
    { path: `public/icons/maskable-${size}.png`, data: maskable },
    { path: `dist/icons/maskable-${size}.png`, data: maskable }
  );
  maskableStats.push(`${size}→${(((m.r * k) / size) * 100).toFixed(1)}%R`);
}
for (const f of files) {
  const dir = f.path.slice(0, f.path.lastIndexOf('/'));
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(f.path, f.data);
}
console.log(
  JSON.stringify({
    source: `${SRC} ${src.w}x${src.h}`,
    content: {
      bbox: `${m.x0},${m.y0}-${m.x1},${m.y1}`,
      center: [Math.round(m.cx), Math.round(m.cy)],
      maxRadius: Math.round(m.r),
    },
    icoBytes: ico.length,
    maskableRadius: maskableStats.join(' '),
    written: files.map((f) => f.path),
  })
);
