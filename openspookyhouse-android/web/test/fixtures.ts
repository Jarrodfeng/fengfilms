// Synthetic stand-ins for the original OBJECTS.DAT / SCENERY.DAT, used only
// by the automated tests. Every frame is a plain coloured box with an
// outline, at a size similar to what the game expects, written as planar
// EGA PCX images in the same container layout the importer reads.
import { SPRITE_CONFIG } from '../src/assets/spriteConfig';

function sizeFor(key: string, frame: number): [number, number] {
  if (key.startsWith('spr_hugo_mini')) return [20, 30];
  if (key.startsWith('spr_dog')) return [30, 30];
  if (/^spr_(hugo|butler|prof|mummy_(left|right|up|down)|guard|igor)/.test(key)) return [26, 46];
  if (key === 'spr_door' || key === 'spr_hall_door') return [26 - frame * 6, 37];
  if (key.startsWith('spr_wardrobe')) return [26 - frame * 6, 53];
  if (key === 'spr_glassdoor') return [44, 58];
  if (key === 'spr_mummy_door') return [30 - frame * 6, 60];
  if (key.startsWith('spr_boat')) return [50, 20];
  if (key === 'spr_old_man') return [16, 30];
  if (key.startsWith('spr_rope')) return [20, 10];
  if (key === 'spr_bat') return [16, 10];
  if (key === 'spr_arc') return [20, 40];
  if (key === 'spr_carpet' || key === 'spr_trap_door') return [40, 14];
  return [14, 14];
}

/** Planar 4-bit PCX; every byte is written as an RLE run (see below). */
function encodePcx(w: number, h: number, pixel: (x: number, y: number) => number): Uint8Array {
  const bytespl = Math.ceil(w / 16) * 2;
  const header = new Uint8Array(128).fill(0xff);
  header[0] = 0x0a;
  header[1] = 5;
  header[2] = 1;
  header[3] = 1;
  const put16 = (o: number, v: number) => {
    header[o] = v & 0xff;
    header[o + 1] = v >> 8;
  };
  put16(4, 0);
  put16(6, 0);
  put16(8, w - 1);
  put16(10, h - 1);
  // Standard EGA palette
  const ega = [
    [0, 0, 0], [0, 0, 170], [0, 170, 0], [0, 170, 170], [170, 0, 0], [170, 0, 170], [170, 85, 0], [170, 170, 170],
    [85, 85, 85], [85, 85, 255], [85, 255, 85], [85, 255, 255], [255, 85, 85], [255, 85, 255], [255, 255, 85], [255, 255, 255],
  ];
  ega.forEach((c, i) => header.set(c, 16 + i * 3));
  header[64] = 0;
  header[65] = 4;
  put16(66, bytespl);
  const out: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let pl = 0; pl < 4; pl++) {
      for (let bx = 0; bx < bytespl; bx++) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
          const x = bx * 8 + bit;
          if (x < w && (pixel(x, y) >> pl) & 1) byte |= 0x80 >> bit;
        }
        // Writing each byte as a (count, value) run keeps every aligned
        // 32-bit word in the image data far larger than the file, so the
        // importer's whole-file index scan can't mistake it for an entry.
        out.push(0xc1, byte === 0 ? 0 : byte);
      }
    }
  }
  const pcx = new Uint8Array(128 + out.length);
  pcx.set(header);
  pcx.set(out, 128);
  return pcx;
}

function boxImage(w: number, h: number, color: number): Uint8Array {
  return encodePcx(w, h, (x, y) => {
    const corner = (x < 2 || x >= w - 2) && (y < 2 || y >= h - 2);
    if (corner) return 0; // transparent corners
    const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
    return edge ? 15 : color;
  });
}

function backgroundImage(index: number): Uint8Array {
  return encodePcx(320, 200, (x, y) => {
    if (y < 10 || y >= 190) return 0;
    const band = Math.floor(y / 25) + index;
    return ((x >> 5) + band) % 2 === 0 ? 8 : 1 + (index % 6);
  });
}

/**
 * Index of (offset, length) pairs followed by the images. Images start 4 bytes
 * past an 8-byte boundary and are padded with 0xFF so that no 8-byte-aligned
 * pair outside the index looks like a valid entry to the importer's scan.
 */
function container(images: Uint8Array[]): Uint8Array {
  const pad8 = (n: number) => (n + 7) & ~7;
  const indexSize = images.length * 8 + 8;
  let offset = indexSize + 4;
  const total = offset + images.reduce((a, b) => a + pad8(b.length), 0);
  const file = new Uint8Array(total).fill(0xff);
  file.fill(0, images.length * 8, indexSize);
  const view = new DataView(file.buffer);
  images.forEach((img, i) => {
    view.setUint32(i * 8, offset, true);
    view.setUint32(i * 8 + 4, img.length, true);
    file.set(img, offset);
    offset += pad8(img.length);
  });
  return file;
}

export function makeDatFiles(): { 'OBJECTS.DAT': Uint8Array; 'SCENERY.DAT': Uint8Array } {
  const objectSizes = new Map<number, [number, number]>();
  let maxObj = 0;
  let maxScn = 0;
  for (const [key, c] of Object.entries(SPRITE_CONFIG)) {
    if (c.dat === 'OBJECTS.DAT') {
      c.dat_frames.forEach((f, i) => {
        if (!objectSizes.has(f)) objectSizes.set(f, sizeFor(key, i));
        maxObj = Math.max(maxObj, f);
      });
    } else c.dat_frames.forEach((f) => (maxScn = Math.max(maxScn, f)));
  }
  const objects: Uint8Array[] = [];
  for (let i = 0; i <= maxObj; i++) {
    const [w, h] = objectSizes.get(i) ?? [10, 10];
    objects.push(boxImage(Math.max(2, w), h, 1 + (i % 14)));
  }
  const scenery: Uint8Array[] = [];
  for (let i = 0; i <= maxScn; i++) scenery.push(backgroundImage(i));
  return { 'OBJECTS.DAT': container(objects), 'SCENERY.DAT': container(scenery) };
}

export const EXPECTED_OBJECT_FRAMES = Math.max(...Object.values(SPRITE_CONFIG).filter((c) => c.dat === 'OBJECTS.DAT').flatMap((c) => c.dat_frames)) + 1;
