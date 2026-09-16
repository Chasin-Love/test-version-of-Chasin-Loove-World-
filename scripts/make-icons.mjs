/**
 * Generates placeholder app icons (PNG + ICO) for the Tauri shell.
 * Pure Node — no image deps. Replace with real artwork via `npm run tauri icon`
 * once a logo exists; these are functional stand-ins so the build is unblocked.
 */
import { deflateSync } from 'node:zlib';
import { crc32 } from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';

function crc32Buf(buf) {
  return crc32(buf) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32Buf(body));
  return Buffer.concat([len, body, crc]);
}

/** Encode RGBA pixels as a PNG. */
function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
}

/** Draw the placeholder: deep-space disc, teal glow, violet rim. */
function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const c = (size - 1) / 2;
  const r = size * 0.44;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - c, dy = y - c;
      const d = Math.sqrt(dx * dx + dy * dy);
      const i = (y * size + x) * 4;
      if (d <= r) {
        const t = d / r;
        // radial gradient: teal core -> violet rim, black pit
        const rr = Math.round(0 + t * 139);
        const gg = Math.round(245 - t * 60);
        const bb = Math.round(212 + t * 34);
        rgba[i] = rr; rgba[i + 1] = gg; rgba[i + 2] = bb; rgba[i + 3] = 255;
        // event horizon pit
        if (t < 0.28) {
          const k = 1 - t / 0.28;
          rgba[i] = Math.round(rr * (1 - k) + 4 * k);
          rgba[i + 1] = Math.round(gg * (1 - k) + 4 * k);
          rgba[i + 2] = Math.round(bb * (1 - k) + 10 * k);
        }
      } else if (d <= r * 1.12) {
        const k = 1 - (d - r) / (r * 0.12);
        rgba[i] = Math.round(0x8b * k); rgba[i + 1] = Math.round(0x5c * k); rgba[i + 2] = Math.round(0xf6 * k);
        rgba[i + 3] = Math.round(160 * k);
      } else {
        rgba[i + 3] = 0;
      }
    }
  }
  return encodePng(size, size, rgba);
}

const outDir = path.join(process.cwd(), 'src-tauri', 'icons');
fs.mkdirSync(outDir, { recursive: true });

const png128 = drawIcon(128);
const png32 = drawIcon(32);
fs.writeFileSync(path.join(outDir, '128x128.png'), png128);
fs.writeFileSync(path.join(outDir, '32x32.png'), png32);

// ICO wrapping the 128px PNG (Vista+ supports PNG-compressed ICO entries).
const count = 1;
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(count, 4);
const entry = Buffer.alloc(16);
entry[0] = 128 % 256; entry[1] = 0; // width
entry[2] = 128 % 256; entry[3] = 0; // height
entry[4] = 0;  // palette colors
entry[5] = 0;  // reserved
entry.writeUInt16LE(1, 6);   // planes
entry.writeUInt16LE(32, 8);  // bits per pixel
entry.writeUInt32LE(png128.length, 12 - 4); // bytes in resource (offset 8)
entry.writeUInt32LE(22, 12); // data offset: 6-byte header + 16-byte entry
fs.writeFileSync(path.join(outDir, 'icon.ico'), Buffer.concat([header, entry, png128]));

console.log('icons written to src-tauri/icons/');
