import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const SIZE = 1024;
const SCALE = 3;
const W = SIZE * SCALE;
const OUT = path.resolve('assets');
fs.mkdirSync(OUT, { recursive: true });

const color = (hex) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function makeCanvas(background) {
  const data = new Uint8Array(W * W * 4);
  if (background) {
    const [r, g, b, a = 255] = background;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a;
    }
  }
  return data;
}

function blend(data, x, y, rgb, alpha = 1) {
  if (x < 0 || y < 0 || x >= W || y >= W || alpha <= 0) return;
  const i = (Math.floor(y) * W + Math.floor(x)) * 4;
  const oldA = data[i + 3] / 255;
  const outA = alpha + oldA * (1 - alpha);
  if (!outA) return;
  data[i] = Math.round((rgb[0] * alpha + data[i] * oldA * (1 - alpha)) / outA);
  data[i + 1] = Math.round((rgb[1] * alpha + data[i + 1] * oldA * (1 - alpha)) / outA);
  data[i + 2] = Math.round((rgb[2] * alpha + data[i + 2] * oldA * (1 - alpha)) / outA);
  data[i + 3] = Math.round(outA * 255);
}

function ellipse(data, cx, cy, rx, ry, fill, rotation = 0) {
  const c = Math.cos(rotation), s = Math.sin(rotation);
  const bound = Math.ceil(Math.max(rx, ry) * SCALE + 2);
  const centerX = cx * SCALE, centerY = cy * SCALE;
  for (let y = Math.max(0, Math.floor(centerY - bound)); y < Math.min(W, centerY + bound); y++) {
    for (let x = Math.max(0, Math.floor(centerX - bound)); x < Math.min(W, centerX + bound); x++) {
      let hits = 0;
      for (const [dx, dy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
        const px = (x + dx - centerX) / SCALE, py = (y + dy - centerY) / SCALE;
        const u = px * c + py * s, v = -px * s + py * c;
        if ((u * u) / (rx * rx) + (v * v) / (ry * ry) <= 1) hits++;
      }
      if (hits) blend(data, x, y, fill, hits / 4);
    }
  }
}

function polygon(data, points, fill) {
  const scaled = points.map(([x, y]) => [x * SCALE, y * SCALE]);
  const minY = Math.max(0, Math.floor(Math.min(...scaled.map((p) => p[1]))));
  const maxY = Math.min(W - 1, Math.ceil(Math.max(...scaled.map((p) => p[1]))));
  for (let y = minY; y <= maxY; y++) {
    for (let x = Math.max(0, Math.floor(Math.min(...scaled.map((p) => p[0])))); x <= Math.min(W - 1, Math.ceil(Math.max(...scaled.map((p) => p[0])))); x++) {
      let hits = 0;
      for (const [dx, dy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
        const px = x + dx, py = y + dy;
        let inside = false;
        for (let i = 0, j = scaled.length - 1; i < scaled.length; j = i++) {
          const [xi, yi] = scaled[i], [xj, yj] = scaled[j];
          if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) hits++;
      }
      if (hits) blend(data, x, y, fill, hits / 4);
    }
  }
}

function line(data, x1, y1, x2, y2, width, fill) {
  const ax = x1 * SCALE, ay = y1 * SCALE, bx = x2 * SCALE, by = y2 * SCALE;
  const vx = bx - ax, vy = by - ay, length2 = vx * vx + vy * vy;
  const radius = width * SCALE / 2;
  const minX = Math.max(0, Math.floor(Math.min(ax, bx) - radius - 1));
  const maxX = Math.min(W - 1, Math.ceil(Math.max(ax, bx) + radius + 1));
  const minY = Math.max(0, Math.floor(Math.min(ay, by) - radius - 1));
  const maxY = Math.min(W - 1, Math.ceil(Math.max(ay, by) + radius + 1));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5, py = y + 0.5;
      const t = clamp(((px - ax) * vx + (py - ay) * vy) / length2, 0, 1);
      const distance = Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
      if (distance < radius + 0.5) blend(data, x, y, fill, clamp(radius + 0.5 - distance, 0, 1));
    }
  }
}

function roundRect(data, x, y, width, height, radius, fill) {
  const minX = Math.floor(x * SCALE), maxX = Math.ceil((x + width) * SCALE);
  const minY = Math.floor(y * SCALE), maxY = Math.ceil((y + height) * SCALE);
  const rr = radius * SCALE;
  for (let py = minY; py <= maxY; py++) for (let px = minX; px <= maxX; px++) {
    let hits = 0;
    for (const [dx, dy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
      const sx = px + dx, sy = py + dy;
      const cx = clamp(sx, minX + rr, maxX - rr), cy = clamp(sy, minY + rr, maxY - rr);
      if ((sx - cx) ** 2 + (sy - cy) ** 2 <= rr ** 2) hits++;
    }
    if (hits) blend(data, px, py, fill, hits / 4);
  }
}

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (-(crc & 1) & 0xedb88320);
  }
  return (crc ^ -1) >>> 0;
}

function pngChunk(type, body) {
  const name = Buffer.from(type);
  const chunk = Buffer.alloc(12 + body.length);
  chunk.writeUInt32BE(body.length, 0);
  name.copy(chunk, 4);
  body.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([name, body])), 8 + body.length);
  return chunk;
}

function writePng(file, data) {
  const rowLength = SIZE * 4;
  const raw = Buffer.alloc((rowLength + 1) * SIZE);
  for (let y = 0; y < SIZE; y++) {
    const from = y * rowLength, to = y * (rowLength + 1);
    raw[to] = 0;
    for (let x = 0; x < SIZE; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SCALE; sy++) for (let sx = 0; sx < SCALE; sx++) {
        const at = (((y * SCALE + sy) * W) + x * SCALE + sx) * 4;
        const sa = data[at + 3] / 255;
        r += data[at] * sa; g += data[at + 1] * sa; b += data[at + 2] * sa; a += sa;
      }
      const pixel = to + 1 + x * 4;
      raw[pixel + 3] = Math.round((a / (SCALE * SCALE)) * 255);
      if (a > 0) {
        raw[pixel] = Math.round(r / a); raw[pixel + 1] = Math.round(g / a); raw[pixel + 2] = Math.round(b / a);
      }
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(SIZE, 0); header.writeUInt32BE(SIZE, 4);
  header[8] = 8; header[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header), pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })), pngChunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(file, png);
}

function drawMark(canvas, palette, scale = 1, ox = 0, oy = 0) {
  const p = (n) => n * scale;
  const leaf = color(palette.leaf), cream = color(palette.cream), stem = color(palette.stem);
  ellipse(canvas, ox + p(420), oy + p(352), p(67), p(35), leaf, -0.58);
  ellipse(canvas, ox + p(604), oy + p(320), p(68), p(35), leaf, 0.62);
  ellipse(canvas, ox + p(512), oy + p(286), p(34), p(54), cream, 0);
  line(canvas, ox + p(512), oy + p(318), ox + p(512), oy + p(522), p(15), stem);
  line(canvas, ox + p(475), oy + p(365), ox + p(432), oy + p(386), p(10), stem);
  line(canvas, ox + p(551), oy + p(348), ox + p(600), oy + p(331), p(10), stem);
  polygon(canvas, [
    [ox + p(316), oy + p(518)], [ox + p(708), oy + p(518)], [ox + p(676), oy + p(612)],
    [ox + p(620), oy + p(668)], [ox + p(404), oy + p(668)], [ox + p(348), oy + p(612)],
  ], cream);
  line(canvas, ox + p(358), oy + p(548), ox + p(666), oy + p(548), p(8), leaf);
}

const forest = color('#374338'), paper = color('#F6F5EF');
const icon = makeCanvas([...paper, 255]);
ellipse(icon, 512, 512, 438, 438, forest);
drawMark(icon, { leaf: '#D9B86C', cream: '#F6F5EF', stem: '#F6F5EF' });
writePng(path.join(OUT, 'icon.png'), icon);

const adaptive = makeCanvas(null);
drawMark(adaptive, { leaf: '#E7C978', cream: '#FFFFFF', stem: '#FFFFFF' });
writePng(path.join(OUT, 'adaptive-icon.png'), adaptive);

const splash = makeCanvas(null);
drawMark(splash, { leaf: '#A88E4B', cream: '#374338', stem: '#374338' }, 0.72, 144, 90);
writePng(path.join(OUT, 'splash.png'), splash);
fs.copyFileSync(path.join(OUT, 'icon.png'), path.join(OUT, 'favicon.png'));

console.log('Generated icon.png, adaptive-icon.png, splash.png and favicon.png (1024×1024).');
