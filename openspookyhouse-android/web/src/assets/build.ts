// Builds the game's sprites from the player's original Hugo's House of
// Horrors files (port of obj_load_controller's _scr_load_sprite and
// scr_create_masked_sprite) and packs every frame into a single atlas.
import { Sprite, FrameRect } from '../engine/sprite';
import { SpriteTable } from '../game/sprites';
import { DEFAULT_SPRITE_SPEED } from '../game/state';
import { RawFrame, loadPix, readGfxDat } from './pcx';
import { SPRITE_CONFIG } from './spriteConfig';

export interface Pixels {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export type AssetFiles = Map<string, Uint8Array>; // upper-case file name -> bytes

export type AssetKind = 'dat' | 'pix';

/** Which files the game needs, and which of them are present. */
export function checkFiles(files: AssetFiles): { kind: AssetKind | null; missing: string[] } {
  if (files.has('OBJECTS.DAT') && files.has('SCENERY.DAT')) return { kind: 'dat', missing: [] };
  const needed = [...new Set(Object.values(SPRITE_CONFIG).map((c) => c.file.toUpperCase()))].sort();
  const missing = needed.filter((f) => !files.has(f));
  if (missing.length === 0) return { kind: 'pix', missing: [] };
  return { kind: null, missing: files.size === 0 ? ['OBJECTS.DAT', 'SCENERY.DAT'] : missing };
}

/** Names of every file the game can use (GOG .DAT or DOS .PIX/.ART). */
export function usefulFileNames(): Set<string> {
  const s = new Set(['OBJECTS.DAT', 'SCENERY.DAT', 'SOUNDS.DAT']);
  for (const c of Object.values(SPRITE_CONFIG)) s.add(c.file.toUpperCase());
  return s;
}

interface BuiltSprite {
  name: string;
  frames: RawFrame[];
  width: number;
  height: number;
  xorigin: number;
  yorigin: number;
  bbox: { left: number; right: number; top: number; bottom: number };
  speed: number;
  precise?: Uint8Array;
}

function blank(w: number, h: number): RawFrame {
  return { w, h, rgba: new Uint8ClampedArray(w * h * 4), xorigin: Math.floor(w / 2), yorigin: Math.floor(h / 2) };
}

/** sprite_merge: frames of a different size are stretched to the first frame's size. */
function stretch(f: RawFrame, w: number, h: number): RawFrame {
  if (f.w === w && f.h === h) return f;
  const out = blank(w, h);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(f.h - 1, Math.floor((y * f.h) / h));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(f.w - 1, Math.floor((x * f.w) / w));
      out.rgba.set(f.rgba.subarray((sy * f.w + sx) * 4, (sy * f.w + sx) * 4 + 4), (y * w + x) * 4);
    }
  }
  return out;
}

/**
 * sprite_merge_custom: draws the frame onto a canvas the size of the first
 * frame, vertically centred. OSH passes "left"/"right" strings where the
 * script expects fa_* constants, so the horizontal offset is always 0.
 */
function placeOnCanvas(f: RawFrame, w: number, h: number): RawFrame {
  const out = blank(w, h);
  const oy = Math.floor((h - f.h) / 2);
  for (let y = 0; y < f.h; y++) {
    const ty = y + oy;
    if (ty < 0 || ty >= h) continue;
    const cols = Math.min(f.w, w);
    out.rgba.set(f.rgba.subarray(y * f.w * 4, (y * f.w + cols) * 4), ty * w * 4);
  }
  return out;
}

function autoBBox(frames: RawFrame[], w: number, h: number) {
  let left = w;
  let right = -1;
  let top = h;
  let bottom = -1;
  for (const f of frames) {
    for (let y = 0; y < f.h; y++)
      for (let x = 0; x < f.w; x++)
        if (f.rgba[(y * f.w + x) * 4 + 3] > 0) {
          if (x < left) left = x;
          if (x > right) right = x;
          if (y < top) top = y;
          if (y > bottom) bottom = y;
        }
  }
  if (right < 0) return { left: 0, right: w - 1, top: 0, bottom: h - 1 };
  return { left, right, top, bottom };
}

/** scr_create_masked_sprite: copies background pixels where the mask is set. */
function maskedSprite(name: string, bg: BuiltSprite, mask: Pixels): BuiltSprite {
  const src = bg.frames[0];
  const out = blank(src.w, src.h);
  const precise = new Uint8Array(src.w * src.h);
  for (let y = 0; y < src.h && y < mask.height; y++) {
    for (let x = 0; x < src.w && x < mask.width; x++) {
      const m = (y * mask.width + x) * 4;
      const set = mask.data[m + 3] > 0 && (mask.data[m] | mask.data[m + 1] | mask.data[m + 2]) !== 0;
      if (!set) continue;
      const i = (y * src.w + x) * 4;
      out.rgba[i] = src.rgba[i];
      out.rgba[i + 1] = src.rgba[i + 1];
      out.rgba[i + 2] = src.rgba[i + 2];
      out.rgba[i + 3] = 255;
      precise[y * src.w + x] = 1;
    }
  }
  return {
    name,
    frames: [out],
    width: src.w,
    height: src.h,
    xorigin: bg.xorigin,
    yorigin: bg.yorigin,
    bbox: autoBBox([out], src.w, src.h),
    speed: DEFAULT_SPRITE_SPEED,
    precise,
  };
}

export interface AtlasMeta {
  v: 1;
  width: number;
  height: number;
  /** Per sprite id: list of frames [ax, ay, w, h, dx, dy]. */
  sprites: { n: string; f: number[][] }[];
}

export interface BuiltAssets {
  table: SpriteTable;
  atlas: Pixels;
  meta: AtlasMeta;
  hash: string;
  kind: AssetKind;
  warnings: string[];
}

export type Progress = (fraction: number, label: string) => void;

const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0));

export async function buildAssets(files: AssetFiles, masks: Record<string, Pixels>, progress: Progress = () => {}): Promise<BuiltAssets> {
  const { kind, missing } = checkFiles(files);
  if (!kind) throw new Error('Missing game files: ' + missing.join(', '));
  const warnings: string[] = [];

  // Hugo's own frames get an eye colour fix (global.cc_sprites_dat)
  const ccIndices = new Set<number>();
  for (const [key, c] of Object.entries(SPRITE_CONFIG))
    if (key.includes('spr_hugo') || key === 'spr_old_man') for (const f of c.dat_frames) ccIndices.add(f);

  let objects: RawFrame[] = [];
  let scenery: RawFrame[] = [];
  const pixCache = new Map<string, RawFrame[]>();
  if (kind === 'dat') {
    progress(0.1, 'Loading OBJECTS.DAT');
    await yieldToUi();
    objects = readGfxDat(files.get('OBJECTS.DAT')!, true, ccIndices);
    progress(0.25, 'Loading SCENERY.DAT');
    await yieldToUi();
    scenery = readGfxDat(files.get('SCENERY.DAT')!, false, new Set());
  }

  const built: BuiltSprite[] = [];
  const keys = Object.keys(SPRITE_CONFIG);
  for (let k = 0; k < keys.length; k++) {
    const key = keys[k];
    const c = SPRITE_CONFIG[key];
    if (k % 10 === 0) {
      progress(0.3 + 0.5 * (k / keys.length), 'Loading ' + key);
      await yieldToUi();
    }
    let source: RawFrame[];
    let indices: number[];
    if (kind === 'dat') {
      source = c.dat === 'OBJECTS.DAT' ? objects : scenery;
      indices = c.dat_frames;
    } else {
      const file = c.file.toUpperCase();
      if (!pixCache.has(file)) pixCache.set(file, loadPix(files.get(file)!, file, !file.endsWith('.ART')));
      source = pixCache.get(file)!;
      indices = c.file_frames;
    }
    const frames: RawFrame[] = [];
    for (const i of indices) {
      const f = source[i];
      if (!f) {
        warnings.push(`${key} requested frame ${i} but there are only ${source.length} frames`);
        continue;
      }
      if (frames.length === 0) frames.push(f);
      else frames.push(c.align ? placeOnCanvas(f, frames[0].w, frames[0].h) : stretch(f, frames[0].w, frames[0].h));
    }
    if (frames.length === 0) {
      warnings.push('No sprite generated for ' + key);
      continue;
    }
    const w = frames[0].w;
    const h = frames[0].h;
    const sprite: BuiltSprite = {
      name: key,
      frames,
      width: w,
      height: h,
      xorigin: c.origin ? c.origin[0] : frames[0].xorigin,
      yorigin: c.origin ? c.origin[1] : frames[0].yorigin,
      bbox: c.bbox ? { left: c.bbox[0], right: c.bbox[1], top: c.bbox[2], bottom: c.bbox[3] } : autoBBox(frames, w, h),
      speed: c.speed ?? DEFAULT_SPRITE_SPEED,
    };
    built.push(sprite);
    for (const m of c.mask ?? []) {
      const img = masks[m.mask];
      if (!img) warnings.push('Missing mask image ' + m.mask);
      else built.push(maskedSprite(m.name, sprite, img));
    }
  }

  progress(0.85, 'Packing sprites');
  await yieldToUi();
  const { atlas, rects } = pack(built);
  const table = new SpriteTable();
  const meta: AtlasMeta = { v: 1, width: atlas.width, height: atlas.height, sprites: [] };
  built.forEach((b, i) => {
    const frames: FrameRect[] = rects[i];
    const s: Omit<Sprite, 'id'> = {
      name: b.name,
      width: b.width,
      height: b.height,
      xorigin: b.xorigin,
      yorigin: b.yorigin,
      bbox: b.bbox,
      speed: b.speed,
      frames,
      precise: b.precise,
    };
    table.add(s);
    meta.sprites.push({ n: b.name, f: frames.map((r) => [r.ax, r.ay, r.w, r.h, r.dx, r.dy]) });
  });
  progress(1, 'Done');
  return { table, atlas, meta, hash: hashAtlas(atlas, meta), kind, warnings };
}

/** Crops each frame to its opaque pixels and shelf-packs them into one image. */
function pack(sprites: BuiltSprite[]): { atlas: Pixels; rects: FrameRect[][] } {
  const W = 2048;
  const items: { s: number; f: number; frame: RawFrame; x0: number; y0: number; w: number; h: number }[] = [];
  sprites.forEach((sp, s) =>
    sp.frames.forEach((frame, f) => {
      let x0 = frame.w;
      let y0 = frame.h;
      let x1 = -1;
      let y1 = -1;
      for (let y = 0; y < frame.h; y++)
        for (let x = 0; x < frame.w; x++)
          if (frame.rgba[(y * frame.w + x) * 4 + 3] > 0) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
      if (x1 < 0) items.push({ s, f, frame, x0: 0, y0: 0, w: 0, h: 0 });
      else items.push({ s, f, frame, x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
    }),
  );
  const rects: FrameRect[][] = sprites.map((sp) => sp.frames.map(() => ({ ax: 0, ay: 0, w: 0, h: 0, dx: 0, dy: 0 })));
  const order = items.filter((i) => i.w > 0).sort((a, b) => b.h - a.h || b.w - a.w);
  let x = 0;
  let y = 0;
  let shelf = 0;
  const placed: { it: (typeof items)[number]; ax: number; ay: number }[] = [];
  for (const it of order) {
    if (x + it.w > W) {
      x = 0;
      y += shelf + 1;
      shelf = 0;
    }
    placed.push({ it, ax: x, ay: y });
    rects[it.s][it.f] = { ax: x, ay: y, w: it.w, h: it.h, dx: it.x0, dy: it.y0 };
    x += it.w + 1;
    shelf = Math.max(shelf, it.h);
  }
  const H = Math.max(1, y + shelf);
  const data = new Uint8ClampedArray(W * H * 4);
  for (const { it, ax, ay } of placed) {
    for (let row = 0; row < it.h; row++) {
      const src = ((it.y0 + row) * it.frame.w + it.x0) * 4;
      data.set(it.frame.rgba.subarray(src, src + it.w * 4), ((ay + row) * W + ax) * 4);
    }
  }
  return { atlas: { width: W, height: H, data }, rects };
}

function hashAtlas(atlas: Pixels, meta: AtlasMeta): string {
  // FNV-1a over the pixels (sampled) and the frame table
  let h = 0x811c9dc5;
  const mix = (v: number) => {
    h ^= v;
    h = Math.imul(h, 0x01000193) >>> 0;
  };
  const d = atlas.data;
  for (let i = 0; i < d.length; i += 7) mix(d[i]);
  const m = JSON.stringify(meta);
  for (let i = 0; i < m.length; i++) mix(m.charCodeAt(i));
  return h.toString(16).padStart(8, '0') + '-' + d.length.toString(16);
}
