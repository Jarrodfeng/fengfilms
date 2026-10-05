// global.sprites plus scr_get_sprite / scr_get_sprite_name / scr_get_background.
import { Sprite } from '../engine/sprite';
import { BUILTIN_SPRITES } from './data.generated';

export class SpriteTable {
  /** Sprites indexed by id (the id is what draw lists reference). */
  readonly list: Sprite[] = [];
  private readonly byName = new Map<string, Sprite>();

  add(s: Omit<Sprite, 'id'>): Sprite {
    const sprite = { ...s, id: this.list.length } as Sprite;
    this.list.push(sprite);
    this.byName.set(sprite.name, sprite);
    return sprite;
  }

  get(name: string): Sprite | undefined {
    return this.byName.get(name);
  }

  has(name: string): boolean {
    return this.byName.has(name);
  }
}

const DEBUG_COLORS: Record<string, number> = {
  spr_debug_red: 0xff0000,
  spr_debug_yellow: 0xffff00,
  spr_debug_blue: 0x0000ff,
  spr_debug_green: 0x00ff00,
  spr_debug_playermask: 0xff00ff,
};

/** Pixel-less sprites that ship with OSH (barriers, triggers, hitboxes). */
export const DEBUG_SPRITES: Record<string, Sprite> = {};
for (const [name, color] of Object.entries(DEBUG_COLORS)) {
  const d = BUILTIN_SPRITES[name];
  DEBUG_SPRITES[name] = {
    id: -1,
    name,
    width: d.width,
    height: d.height,
    xorigin: d.xorigin,
    yorigin: d.yorigin,
    bbox: { left: d.bbox[0], right: d.bbox[1], top: d.bbox[2], bottom: d.bbox[3] },
    speed: 0,
    frames: [],
    debugColor: color,
  };
}

let table = new SpriteTable();

export function setSpriteTable(t: SpriteTable): void {
  table = t;
}

export function spriteTable(): SpriteTable {
  return table;
}

/** scr_get_sprite: -1 means "no sprite"; unknown names fall back to a debug sprite. */
export function getSprite(name: string | number | null | undefined): Sprite | null {
  if (name === -1 || name === null || name === undefined) return null;
  const s = table.get(String(name));
  if (s) return s;
  console.warn('ERROR: Could not find sprite ' + name);
  return DEBUG_SPRITES.spr_debug_green;
}

/** scr_get_sprite_name: reverse lookup, -1 when the sprite is not in the table. */
export function spriteName(s: Sprite | null): string | number {
  if (!s || s.id < 0) return -1;
  return s.name;
}

/** scr_get_background */
export function getBackground(name: string): Sprite | null {
  return table.get(name) ?? null;
}
