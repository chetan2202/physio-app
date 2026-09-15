// Generate PWA icons (dependency-free) into public/icons/.
// Physio is a physiotherapy / rehab app, so the icon is a white "active figure" — a
// person mid-stretch with arms raised and legs apart — on a brand-teal tile. It reads as
// movement and wellbeing, not a generic medical cross. Flat, no emoji. Full-bleed, safe
// for both "any" and "maskable" purposes. PNG encoded with Node zlib only.

import zlib from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

const TEAL = [13, 148, 136];
const WHITE = [255, 255, 255];

// Distance from point (px,py) to segment (ax,ay)-(bx,by). Used to draw rounded "capsule"
// limbs: a pixel is inside a limb when its distance to the bone is <= the limb radius.
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function iconPixels(N) {
  const buf = Buffer.alloc(N * N * 4);

  // Active human figure, coordinates as fractions of N.
  const head = { x: 0.5 * N, y: 0.235 * N, r: 0.105 * N };
  const shoulder = { x: 0.5 * N, y: 0.40 * N };
  const hip = { x: 0.5 * N, y: 0.585 * N };
  // Limbs as bones (start -> end): torso, two raised arms, two spread legs.
  const bones = [
    [shoulder.x, shoulder.y, hip.x, hip.y],       // torso
    [shoulder.x, shoulder.y, 0.275 * N, 0.30 * N], // left arm (raised)
    [shoulder.x, shoulder.y, 0.725 * N, 0.30 * N], // right arm (raised)
    [hip.x, hip.y, 0.315 * N, 0.80 * N],           // left leg
    [hip.x, hip.y, 0.685 * N, 0.80 * N],           // right leg
  ];
  const limb = 0.055 * N; // limb radius (half-thickness)

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const px = x + 0.5, py = y + 0.5;
      let col = TEAL;

      let white = Math.hypot(px - head.x, py - head.y) <= head.r;
      if (!white) {
        for (const b of bones) {
          if (distToSegment(px, py, b[0], b[1], b[2], b[3]) <= limb) { white = true; break; }
        }
      }
      if (white) col = WHITE;

      const i = (y * N + x) * 4;
      buf[i] = col[0];
      buf[i + 1] = col[1];
      buf[i + 2] = col[2];
      buf[i + 3] = 255;
    }
  }
  return buf;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(body) >>> 0, 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(N, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(N, 0);
  ihdr.writeUInt32BE(N, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  const stride = N * 4;
  const raw = Buffer.alloc(N * (stride + 1));
  for (let y = 0; y < N; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

mkdirSync(OUT, { recursive: true });
for (const size of [192, 512]) {
  const png = encodePng(size, iconPixels(size));
  writeFileSync(join(OUT, `icon-${size}.png`), png);
  console.log(`wrote icon-${size}.png (${png.length} bytes)`);
}
