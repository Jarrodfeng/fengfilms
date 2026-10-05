// A small GameMaker-style runtime: rooms, object instances with inheritance,
// the per-step event order, alarms, sprite animation, depth sorting and
// bounding-box / precise collisions. It exists so the OpenSpookyHouse GML can
// be ported object-for-object with the same behaviour.
import { Sprite } from './sprite';
import { Cmd, DrawList } from '../render/drawlist';

export const ROOM_SPEED = 60;
/** GameMaker compares reals with an epsilon (math_get_epsilon, default 1e-5). */
export const EPS = 0.00001;
export const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

export type Ctor<T extends Instance = Instance> = (new (game: Game) => T) & { objName: string };

export interface Box {
  l: number;
  t: number;
  r: number;
  b: number;
}

export abstract class Instance {
  static objName = 'obj_instance';

  readonly game: Game;
  id = 0;
  x = 0;
  y = 0;
  xprevious = 0;
  yprevious = 0;
  xscale = 1;
  yscale = 1;
  private _depth = 0;
  /** Insertion order inside a depth bucket (changing depth appends). */
  depthSeq = 0;
  sprite: Sprite | null = null;
  imageIndex = 0;
  imageSpeed = 1;
  visible = true;
  solid = false;
  persistent = false;
  alarm: number[] = [-1, -1, -1, -1];
  destroyed = false;

  constructor(game: Game) {
    this.game = game;
  }

  get objName(): string {
    return (this.constructor as Ctor).objName;
  }

  get depth(): number {
    return this._depth;
  }
  set depth(v: number) {
    if (v !== this._depth) {
      this._depth = v;
      this.depthSeq = this.game.nextSeq++;
    }
  }

  get imageNumber(): number {
    return this.sprite ? this.sprite.frames.length || 1 : 0;
  }
  get spriteWidth(): number {
    return this.sprite ? this.sprite.width * this.xscale : 0;
  }
  get spriteHeight(): number {
    return this.sprite ? this.sprite.height * this.yscale : 0;
  }

  // ---- Events (override in objects) ----
  create(): void {}
  roomStart(): void {}
  beginStep(): void {}
  step(): void {}
  endStep(): void {}
  alarmEvent(_n: number): void {}
  keyPress(_key: number): void {}
  /** Return the collision events this object listens for. */
  collisionEvents(): [Ctor, (other: any) => void][] {
    return [];
  }
  draw(list: DrawList): void {
    this.drawSelf(list);
  }
  drawGui(_list: DrawList): void {}
  drawGuiEnd(_list: DrawList): void {}

  drawSelf(list: DrawList): void {
    const s = this.sprite;
    if (!s) return;
    if (s.debugColor !== undefined) {
      const box = this.game.bboxAt(this, this.x, this.y);
      if (box) list.push([Cmd.AlphaRect, Math.round(box.l), Math.round(box.t), Math.round(box.r - box.l), Math.round(box.b - box.t), s.debugColor, 110]);
      return;
    }
    if (s.frames.length === 0) return;
    const n = s.frames.length;
    const f = ((Math.floor(this.imageIndex) % n) + n) % n;
    list.push([Cmd.Sprite, s.id, f, Math.round(this.x - s.xorigin), Math.round(this.y - s.yorigin)]);
  }

  /** bbox_bottom - bbox_top as used by the player movement code. */
  get bboxHeight(): number {
    const b = this.game.bboxAt(this, this.x, this.y);
    return b ? Math.round(b.b - b.t) - 1 : 0;
  }
}

export interface RoomInstanceDef {
  obj: string;
  x: number;
  y: number;
  sx: number;
  sy: number;
  depth: number;
}

export interface RoomDef {
  width: number;
  height: number;
  instances: RoomInstanceDef[];
}

export interface RuntimeHooks {
  /** Called with the room's background sprite (or null) whenever it is drawn. */
  background(room: string): Sprite | null;
  /** Called after a room change completes and Room Start events have run. */
  onRoomChanged?(room: string): void;
}

export class Game {
  instances: Instance[] = [];
  room = '';
  roomWidth = 320;
  roomHeight = 200;
  pendingRoom: string | null = null;
  nextId = 100000;
  nextSeq = 1;
  readonly objects = new Map<string, Ctor>();
  readonly rooms: Record<string, RoomDef>;
  keyQueue: number[] = [];
  /** Last world-only draw list (GameMaker's application_surface). */
  lastWorld: DrawList = [];
  stepCount = 0;
  hooks: RuntimeHooks;
  /** Set when game_end() is called. */
  ended = false;
  onEnd: (() => void) | null = null;

  constructor(rooms: Record<string, RoomDef>, hooks: RuntimeHooks) {
    this.rooms = rooms;
    this.hooks = hooks;
  }

  register(...ctors: Ctor[]): void {
    for (const c of ctors) this.objects.set(c.objName, c);
  }

  objectByName(name: string): Ctor | undefined {
    return this.objects.get(name);
  }

  // ---- Instance management ----

  private spawn<T extends Instance>(ctor: Ctor<T>, x: number, y: number, depth: number, sx = 1, sy = 1): T {
    const inst = new ctor(this);
    inst.id = this.nextId++;
    inst.x = inst.xprevious = x;
    inst.y = inst.yprevious = y;
    inst.xscale = sx;
    inst.yscale = sy;
    inst.depth = depth;
    this.instances.push(inst);
    inst.create();
    return inst;
  }

  /** instance_create_depth */
  instanceCreate<T extends Instance>(ctor: Ctor<T>, x: number, y: number, depth: number): T {
    return this.spawn(ctor, x, y, depth);
  }

  /** instance_destroy(inst) */
  destroy(inst: Instance): void {
    inst.destroyed = true;
  }

  /** instance_destroy(obj) - destroys every instance of an object (and children). */
  destroyAll(ctor: Ctor): void {
    for (const i of this.instances) if (!i.destroyed && i instanceof ctor) i.destroyed = true;
  }

  private sweep(): void {
    if (this.instances.some((i) => i.destroyed)) this.instances = this.instances.filter((i) => !i.destroyed);
  }

  all<T extends Instance>(ctor: Ctor<T>): T[] {
    const out: T[] = [];
    for (const i of this.instances) if (!i.destroyed && i instanceof ctor) out.push(i as T);
    return out;
  }

  first<T extends Instance>(ctor: Ctor<T>): T | null {
    for (const i of this.instances) if (!i.destroyed && i instanceof ctor) return i as T;
    return null;
  }

  /** with (obj) { ... } */
  with<T extends Instance>(ctor: Ctor<T>, fn: (inst: T) => void): void {
    for (const i of this.all(ctor)) if (!i.destroyed) fn(i);
  }

  exists(ctor: Ctor): boolean {
    return this.first(ctor) !== null;
  }

  count(ctor: Ctor): number {
    return this.all(ctor).length;
  }

  // ---- Collision ----

  bboxAt(inst: Instance, x: number, y: number): Box | null {
    const s = inst.sprite;
    if (!s) return null;
    let l = x + (s.bbox.left - s.xorigin) * inst.xscale;
    let r = x + (s.bbox.right + 1 - s.xorigin) * inst.xscale;
    let t = y + (s.bbox.top - s.yorigin) * inst.yscale;
    let b = y + (s.bbox.bottom + 1 - s.yorigin) * inst.yscale;
    if (l > r) [l, r] = [r, l];
    if (t > b) [t, b] = [b, t];
    return { l, t, r, b };
  }

  private preciseHit(inst: Instance, ix: number, iy: number, box: Box, other: Box): boolean {
    const s = inst.sprite!;
    const mask = s.precise!;
    const ox = ix - s.xorigin * inst.xscale;
    const oy = iy - s.yorigin * inst.yscale;
    const x0 = Math.floor(Math.max(box.l, other.l));
    const x1 = Math.ceil(Math.min(box.r, other.r));
    const y0 = Math.floor(Math.max(box.t, other.t));
    const y1 = Math.ceil(Math.min(box.b, other.b));
    for (let py = y0; py < y1; py++) {
      const cy = py + 0.5;
      if (cy < other.t || cy >= other.b || cy < box.t || cy >= box.b) continue;
      const sy = Math.floor((cy - oy) / inst.yscale);
      if (sy < 0 || sy >= s.height) continue;
      for (let px = x0; px < x1; px++) {
        const cx = px + 0.5;
        if (cx < other.l || cx >= other.r || cx < box.l || cx >= box.r) continue;
        const sx = Math.floor((cx - ox) / inst.xscale);
        if (sx < 0 || sx >= s.width) continue;
        if (mask[sy * s.width + sx]) return true;
      }
    }
    return false;
  }

  /** True when `a` placed at (ax, ay) overlaps `b` at its current position. */
  overlaps(a: Instance, ax: number, ay: number, b: Instance): boolean {
    const ba = this.bboxAt(a, ax, ay);
    const bb = this.bboxAt(b, b.x, b.y);
    if (!ba || !bb) return false;
    if (!(ba.l < bb.r && bb.l < ba.r && ba.t < bb.b && bb.t < ba.b)) return false;
    if (a.sprite!.precise && !this.preciseHit(a, ax, ay, ba, bb)) return false;
    if (b.sprite!.precise && !this.preciseHit(b, b.x, b.y, bb, ba)) return false;
    return true;
  }

  /** instance_place(x, y, obj) */
  instancePlace<T extends Instance>(self: Instance, x: number, y: number, ctor: Ctor<T>): T | null {
    for (const o of this.instances) {
      if (o === self || o.destroyed || !(o instanceof ctor)) continue;
      if (this.overlaps(self, x, y, o)) return o as T;
    }
    return null;
  }

  /** place_meeting(x, y, obj) */
  placeMeeting(self: Instance, x: number, y: number, ctor: Ctor): boolean {
    return this.instancePlace(self, x, y, ctor) !== null;
  }

  // ---- Rooms ----

  roomGoto(name: string): void {
    this.pendingRoom = name;
  }

  gameEnd(): void {
    this.ended = true;
    this.onEnd?.();
  }

  /** Performs a pending room change (GameMaker defers room_goto). */
  private changeRoom(): void {
    const name = this.pendingRoom!;
    this.pendingRoom = null;
    for (const i of this.instances) if (!i.persistent) i.destroyed = true;
    this.sweep();
    const def = this.rooms[name];
    if (!def) throw new Error('Unknown room ' + name);
    this.room = name;
    this.roomWidth = def.width;
    this.roomHeight = def.height;
    for (const d of def.instances) {
      const ctor = this.objects.get(d.obj);
      if (!ctor) continue; // debug-only objects that are not ported
      this.spawn(ctor, d.x, d.y, d.depth, d.sx, d.sy);
    }
    for (const i of [...this.instances]) if (!i.destroyed) i.roomStart();
    this.sweep();
    this.hooks.onRoomChanged?.(name);
  }

  /** Starts the game in a room right away. */
  startIn(name: string): void {
    this.pendingRoom = name;
    this.changeRoom();
  }

  private phase(fn: (i: Instance) => void): boolean {
    for (const i of [...this.instances]) {
      if (i.destroyed) continue;
      fn(i);
    }
    this.sweep();
    if (this.pendingRoom !== null) {
      this.changeRoom();
      return false;
    }
    return !this.ended;
  }

  /** Runs one game step (1/60 s) using GameMaker's event order. */
  tick(): void {
    if (this.ended) return;
    this.stepCount++;
    if (this.pendingRoom !== null) this.changeRoom();
    for (const i of this.instances) {
      i.xprevious = i.x;
      i.yprevious = i.y;
    }
    if (!this.phase((i) => i.beginStep())) return;
    if (
      !this.phase((i) => {
        for (let n = 0; n < i.alarm.length; n++) {
          if (i.alarm[n] > 0) {
            i.alarm[n] -= 1;
            if (i.alarm[n] <= 0) {
              i.alarm[n] = -1;
              if (!i.destroyed) i.alarmEvent(n);
            }
          }
        }
      })
    )
      return;
    // One key press per step keeps room changes triggered by a key from
    // swallowing the next key.
    const key = this.keyQueue.shift();
    if (key !== undefined && !this.phase((i) => i.keyPress(key))) return;
    if (!this.phase((i) => i.step())) return;
    if (
      !this.phase((i) => {
        for (const [ctor, handler] of i.collisionEvents()) {
          for (const o of this.instances) {
            if (i.destroyed) return;
            if (o === i || o.destroyed || !(o instanceof ctor)) continue;
            if (!this.overlaps(i, i.x, i.y, o)) continue;
            if (o.solid) {
              i.x = i.xprevious;
              i.y = i.yprevious;
            }
            handler(o);
          }
        }
      })
    )
      return;
    if (!this.phase((i) => i.endStep())) return;
    for (const i of this.instances) {
      const s = i.sprite;
      if (!s || s.frames.length === 0) continue;
      const n = s.frames.length;
      i.imageIndex += (i.imageSpeed * s.speed) / ROOM_SPEED;
      if (i.imageIndex >= n) i.imageIndex -= n * Math.floor(i.imageIndex / n);
      else if (i.imageIndex < 0) i.imageIndex += n * Math.ceil(-i.imageIndex / n);
    }
  }

  /** Builds the full frame: world (background + instances by depth) then GUI. */
  render(): DrawList {
    const world: DrawList = [];
    const bg = this.hooks.background(this.room);
    if (bg && bg.frames.length) world.push([Cmd.Sprite, bg.id, 0, 0, 0]);
    const sorted = this.instances
      .filter((i) => !i.destroyed && i.visible)
      .sort((a, b) => b.depth - a.depth || a.depthSeq - b.depthSeq);
    for (const i of sorted) i.draw(world);
    this.lastWorld = world;
    const list: DrawList = world.slice();
    for (const i of this.instances) if (!i.destroyed) i.drawGui(list);
    for (const i of this.instances) if (!i.destroyed) i.drawGuiEnd(list);
    return list;
  }
}

// ---- GML helpers ----

export function irandomRange(a: number, b: number): number {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return Math.floor(lo + Math.random() * (Math.floor(hi) - Math.ceil(lo) + 1));
}

export function irandom(n: number): number {
  return Math.floor(Math.random() * (Math.floor(n) + 1));
}

export function pointDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function pointDirection(x1: number, y1: number, x2: number, y2: number): number {
  const d = (Math.atan2(-(y2 - y1), x2 - x1) * 180) / Math.PI;
  return (d + 360) % 360;
}

export function lengthdirX(len: number, dir: number): number {
  return len * Math.cos((dir * Math.PI) / 180);
}

export function lengthdirY(len: number, dir: number): number {
  return -len * Math.sin((dir * Math.PI) / 180);
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
