// Readers for the original Hugo's House of Horrors graphics, ported from
// scripts/scr_load_dat (GOG OBJECTS.DAT / SCENERY.DAT) and scripts/scr_load_pix
// (DOS *.PIX / *.ART). The frame numbering in spriteConfig.ts was worked out
// against exactly these scanning rules, so they are reproduced faithfully -
// including the quirks.

export interface RawFrame {
  w: number;
  h: number;
  /** RGBA pixels, row-major. */
  rgba: Uint8ClampedArray;
  xorigin: number;
  yorigin: number;
}

const u8 = (b: Uint8Array, o: number) => (o < b.length && o >= 0 ? b[o] : 0);
const u16 = (b: Uint8Array, o: number) => u8(b, o) | (u8(b, o + 1) << 8);
const s16 = (b: Uint8Array, o: number) => {
  const v = u16(b, o);
  return v >= 0x8000 ? v - 0x10000 : v;
};

/** Hugo's eyes come out a muddy yellow; OSH recolours them brown. */
function fixEyes(rgb: number[]): number[] {
  return rgb[0] === 170 && rgb[1] === 170 && rgb[2] === 0 ? [159, 90, 31] : rgb;
}

class OutOfRange extends Error {}

/** RLE-decodes PCX data starting at `start`, up to `expected` bytes. */
function rleDecode(buf: Uint8Array, start: number, expected: number, strict: boolean): { data: Uint8Array; count: number; end: number } {
  const data = new Uint8Array(expected);
  let count = 0;
  let p = start;
  while (count < expected && p < buf.length) {
    const v = buf[p++];
    if (v >= 0xc0) {
      if (strict && p >= buf.length) throw new OutOfRange();
      const cnt = v & 0x3f;
      const val = u8(buf, p++);
      for (let k = 0; k < cnt && count < expected; k++) data[count++] = val;
    } else data[count++] = v;
  }
  return { data, count, end: p };
}

function palette16(buf: Uint8Array, at: number): number[][] {
  const pal: number[][] = [];
  for (let i = 0; i < 16; i++) pal.push([u8(buf, at + 16 + i * 3), u8(buf, at + 17 + i * 3), u8(buf, at + 18 + i * 3)]);
  return pal;
}

// ---------------------------------------------------------------------------
// GOG version: OBJECTS.DAT / SCENERY.DAT
// ---------------------------------------------------------------------------

/**
 * scr_parse_pcx: parses one planar PCX image at the start of `buf`.
 * Returns undefined where the GML returned undefined (including the cases
 * where it threw inside its try/catch).
 */
function parsePcxDat(buf: Uint8Array, useTransparency: boolean, colorFix: boolean): RawFrame | undefined {
  try {
    if (u8(buf, 0) !== 0x0a || u8(buf, 2) !== 1) return undefined;
    const width = s16(buf, 8) - s16(buf, 4) + 1;
    const height = s16(buf, 10) - s16(buf, 6) + 1;
    const planes = u8(buf, 65);
    const bytespl = u16(buf, 66);
    const pal = palette16(buf, 0);
    if (planes <= 1) return undefined; // only planar EGA images are handled
    const expected = bytespl * planes * height;
    const { data, count } = rleDecode(buf, 128, expected, true);
    if (width <= 0 || height <= 0) return undefined;
    const rgba = new Uint8ClampedArray(width * height * 4);
    let o = 0;
    for (let y = 0; y < height; y++) {
      const line = y * bytespl * planes;
      for (let x = 0; x < width; x++) {
        const byteIndex = x >> 3;
        const bit = 7 - (x & 7);
        let val = 0;
        for (let pl = 0; pl < planes; pl++) {
          const idx = line + pl * bytespl + byteIndex;
          // Reading past the decoded data raised an error in GML
          if (idx >= count) throw new OutOfRange();
          if ((data[idx] >> bit) & 1) val |= 1 << pl;
        }
        let rgb = val < 16 ? pal[val] : [0, 0, 0];
        if (colorFix) rgb = fixEyes(rgb);
        rgba[o++] = rgb[0];
        rgba[o++] = rgb[1];
        rgba[o++] = rgb[2];
        rgba[o++] = useTransparency && val === 0 ? 0 : 255;
      }
    }
    return { w: width, h: height, rgba, xorigin: Math.floor(width / 2), yorigin: Math.floor(height / 2) };
  } catch {
    return undefined;
  }
}

/** scr_parse_pcx_buffer: every PCX header found in an index entry is a frame. */
function parsePcxEntry(buf: Uint8Array, useTransparency: boolean, colorFix: boolean, limit = Infinity): RawFrame[] {
  const out: RawFrame[] = [];
  let pos = 0;
  while (pos <= buf.length - 128 && out.length < limit) {
    if (buf[pos] === 0x0a && u8(buf, pos + 2) === 0x01) {
      const width = u16(buf, pos + 8) - u16(buf, pos + 4) + 1;
      const height = u16(buf, pos + 10) - u16(buf, pos + 6) + 1;
      if (width > 0 && width <= 320 && height > 0 && height <= 200) {
        const frame = parsePcxDat(buf.subarray(pos), useTransparency, colorFix);
        if (frame) out.push(frame);
        // Skip past this image (at least the header)
        pos += 128;
      } else pos++;
    } else pos++;
  }
  return out;
}

/**
 * scr_read_gfx_dat. `colorFixIndices` holds the sprite indices of Hugo's
 * frames; the fix is applied per index entry, keyed by the number of frames
 * read before that entry, exactly like the GML.
 *
 * The whole-file index scan turns up tens of thousands of bogus "frames" in
 * the real GOG files (over a gigabyte of pixels), but frames are numbered in
 * file order, so reading stops once `limit` frames exist. The frames below
 * the limit are identical to a full scan.
 */
export function readGfxDat(file: Uint8Array, useTransparency: boolean, colorFixIndices: Set<number>, limit = Infinity): RawFrame[] {
  const size = file.length;
  const entries: { offset: number; length: number }[] = [];
  // The index is read as (offset, length) pairs through the whole file,
  // skipping anything that can't be an entry.
  for (let pos = 0; pos < size - 8; pos += 8) {
    const offset = (u8(file, pos) | (u8(file, pos + 1) << 8) | (u8(file, pos + 2) << 16)) + u8(file, pos + 3) * 16777216;
    const length = (u8(file, pos + 4) | (u8(file, pos + 5) << 8) | (u8(file, pos + 6) << 16)) + u8(file, pos + 7) * 16777216;
    if (offset === 0 || length === 0 || offset >= size) continue;
    entries.push({ offset, length });
  }
  const sprites: RawFrame[] = [];
  for (const e of entries) {
    if (sprites.length >= limit) break;
    // Bytes past the end of the file read as zero. Bogus entries can claim
    // gigabytes, so the zero padding is capped (it can never hold a header).
    const entry = new Uint8Array(Math.min(e.length, size - e.offset + 65536));
    entry.set(file.subarray(e.offset, Math.min(size, e.offset + e.length)));
    const frames = parsePcxEntry(entry, useTransparency, colorFixIndices.has(sprites.length), limit - sprites.length);
    for (const f of frames) sprites.push(f);
  }
  return sprites.length > limit ? sprites.slice(0, limit) : sprites;
}

// ---------------------------------------------------------------------------
// DOS version: *.PIX / *.ART (concatenated PCX images)
// ---------------------------------------------------------------------------

/** scr_load_pix */
export function loadPix(file: Uint8Array, filename: string, useTransparency: boolean): RawFrame[] {
  const frames: RawFrame[] = [];
  const name = filename.toUpperCase();
  const colorFix = name.includes('HERO.PIX') || name.includes('OLDMAN.PIX');
  const size = file.length;
  let pos = 0;
  while (pos <= size - 128) {
    if (file[pos] !== 0x0a || u8(file, pos + 2) !== 1) {
      pos++;
      continue;
    }
    const width = s16(file, pos + 8) - s16(file, pos + 4) + 1;
    const height = s16(file, pos + 10) - s16(file, pos + 6) + 1;
    const bpp = u8(file, pos + 3);
    const planes = u8(file, pos + 65);
    const bytespl = u16(file, pos + 66);
    const pal16 = palette16(file, pos);
    const planar = !(bpp === 8 && planes === 1);
    const expected = planar ? bytespl * planes * height : bytespl * height;
    if (width <= 0 || height <= 0 || expected <= 0) {
      pos++;
      continue;
    }
    const { data, end } = rleDecode(file, pos + 128, expected, false);
    let stream = end;

    // 8-bit images may carry a 256 colour palette after the pixel data
    let pal256: number[][] | null = null;
    if (!planar) {
      pal256 = [];
      if (stream < size && file[stream] === 0x0c && stream + 769 <= size) {
        for (let i = 0; i < 256; i++) pal256.push([file[stream + 1 + i * 3], file[stream + 2 + i * 3], file[stream + 3 + i * 3]]);
        stream += 769;
      } else for (let i = 0; i < 256; i++) pal256.push(i < 16 ? pal16[i] : [0, 0, 0]);
    }

    const rgba = new Uint8ClampedArray(width * height * 4);
    let o = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let val: number;
        if (!planar) val = data[y * bytespl + x] ?? 0;
        else {
          val = 0;
          const line = y * bytespl * planes;
          for (let pl = 0; pl < planes; pl++) if (((data[line + pl * bytespl + (x >> 3)] ?? 0) >> (7 - (x & 7))) & 1) val |= 1 << pl;
        }
        let rgb = planar ? (val < 16 ? pal16[val] : [0, 0, 0]) : pal256![val];
        if (planar && colorFix) rgb = fixEyes(rgb);
        rgba[o++] = rgb[0];
        rgba[o++] = rgb[1];
        rgba[o++] = rgb[2];
        rgba[o++] = useTransparency && val === 0 ? 0 : 255;
      }
    }
    frames.push({ w: width, h: height, rgba, xorigin: Math.floor(width / 2), yorigin: Math.floor(height / 2) });
    pos = stream;
  }
  return frames;
}
