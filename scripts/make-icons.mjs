// Draws the Farshore app icons into public/icons/ using only Node built-ins.
// Usage: node scripts/make-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
const SS = 4; // supersamples per axis

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

const SKY = [hex('#3fc7c0'), hex('#7f8ff0'), hex('#ff8fc0')];
const WHITE = hex('#ffffff');
const OUTLINE = hex('#fff4f8');
const PETAL = hex('#ff6fa8');
const PETAL_SHADE = hex('#f0508f');
const INNER = hex('#ff94bf');
const CENTRE = hex('#ffd84a');
const STAMEN = hex('#f59b2f');

function background(y) {
  const t = Math.min(Math.max(y, 0), 1) * 2;
  return t < 1 ? mix(SKY[0], SKY[1], t) : mix(SKY[1], SKY[2], t - 1);
}

// Five ellipse petals rotated around (cx, cy), matching petals() in src/ui/icons.js.
const ANGLES = [0, 72, 144, 216, 288].map((a) => ({ c: Math.cos((-a * Math.PI) / 180), s: Math.sin((-a * Math.PI) / 180) }));
function inPetals(x, y, cx, cy, r, grow = 0) {
  const rx = r * 0.5 + grow, ry = r * 0.66 + grow, oy = -r * 0.62;
  const dx = x - cx, dy = y - cy;
  for (const { c, s } of ANGLES) {
    const lx = dx * c - dy * s, ly = dx * s + dy * c - oy;
    if ((lx * lx) / (rx * rx) + (ly * ly) / (ry * ry) <= 1) return true;
  }
  return false;
}

const inCircle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;

function inWave(x, y, y0, amp, freq, phase, half) {
  const mid = y0 + amp * Math.sin((x * freq + phase) * Math.PI * 2);
  return Math.abs(y - mid) <= half;
}

// Colour at a point in icon space (0..1). `k` scales the motif about the centre (maskable safe zone).
function shade(px, py, k) {
  const x = 0.5 + (px - 0.5) / k, y = 0.5 + (py - 0.5) / k;
  const cx = 0.5, cy = 0.44, r = 0.25;

  if (inCircle(x, y, cx, cy, r * 0.25)) return inCircle(x, y, cx, cy, r * 0.11) ? STAMEN : CENTRE;
  if (inPetals(x, y, cx, cy, r * 0.6)) return INNER;
  if (inPetals(x, y, cx, cy, r)) {
    const d = Math.hypot(x - cx, y - cy) / (r * 1.28);
    return mix(PETAL_SHADE, PETAL, Math.min(1, d * 1.4));
  }
  if (inPetals(x, y, cx, cy, r, 0.018)) return OUTLINE;

  if (inWave(px, py, 0.82, 0.018, 1.5, 0.1, 0.022)) return WHITE;
  if (inWave(px, py, 0.9, 0.014, 1.5, 0.6, 0.012)) return mix(WHITE, background(py), 0.35);
  return background(py);
}

function render(size, k) {
  const rgb = Buffer.alloc(size * size * 3);
  const n = SS * SS;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = shade((i + (sx + 0.5) / SS) / size, (j + (sy + 0.5) / SS) / size, k);
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const o = (j * size + i) * 3;
      rgb[o] = Math.round(r / n); rgb[o + 1] = Math.round(g / n); rgb[o + 2] = Math.round(b / n);
    }
  }
  return rgb;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// Opaque 8-bit RGB PNG (colour type 2): iOS home-screen icons must not carry alpha.
function encodePNG(size, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = size * 3;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Maskable: motif shrunk so it stays inside the central 80% safe-zone circle.
const ICONS = [
  { file: 'icon-180.png', size: 180, k: 1 },
  { file: 'icon-192.png', size: 192, k: 1 },
  { file: 'icon-512.png', size: 512, k: 1 },
  { file: 'icon-maskable-512.png', size: 512, k: 0.8 },
];

mkdirSync(OUT, { recursive: true });
for (const { file, size, k } of ICONS) {
  writeFileSync(join(OUT, file), encodePNG(size, render(size, k)));
  console.log(`wrote public/icons/${file}`);
}
