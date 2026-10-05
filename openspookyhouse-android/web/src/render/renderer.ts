// Draws a DrawList onto a 320x200 canvas. Used by the phone, the Chromecast
// receiver and secondary displays, so every screen renders identically.
// The canvas stays at native resolution and is scaled up by CSS with
// `image-rendering: pixelated`, which the GPU compositor does for free.
import { Cmd, DrawList, SCREEN_H, SCREEN_W } from './drawlist';
import { glyph, lineWidth } from './font';

export type AtlasFrames = number[][][]; // sprite id -> frame -> [ax, ay, w, h, dx, dy]

const css = (rgb: number) => '#' + (rgb & 0xffffff).toString(16).padStart(6, '0');

export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  private atlas: CanvasImageSource | null = null;
  private frames: AtlasFrames = [];
  private readonly font: HTMLImageElement;
  private fontReady = false;
  private readonly tinted = new Map<number, HTMLCanvasElement>();

  constructor(canvas: HTMLCanvasElement, fontUrl: string) {
    canvas.width = SCREEN_W;
    canvas.height = SCREEN_H;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
    ctx.imageSmoothingEnabled = false;
    this.font = new Image();
    this.font.onload = () => {
      this.fontReady = true;
      this.tinted.clear();
    };
    this.font.src = fontUrl;
  }

  get ready(): boolean {
    return this.fontReady;
  }

  setAtlas(image: CanvasImageSource | null, frames: AtlasFrames): void {
    this.atlas = image;
    this.frames = frames;
  }

  private fontIn(rgb: number): HTMLCanvasElement | null {
    if (!this.fontReady) return null;
    let c = this.tinted.get(rgb);
    if (!c) {
      c = document.createElement('canvas');
      c.width = this.font.naturalWidth;
      c.height = this.font.naturalHeight;
      const x = c.getContext('2d')!;
      x.drawImage(this.font, 0, 0);
      x.globalCompositeOperation = 'source-in';
      x.fillStyle = css(rgb);
      x.fillRect(0, 0, c.width, c.height);
      this.tinted.set(rgb, c);
    }
    return c;
  }

  private text(x: number, y: number, s: string, rgb: number, halign: number, valign: number, sep: number, scale: number): void {
    const tex = this.fontIn(rgb);
    if (!tex) return;
    const lines = s.split('\n');
    const total = lines.length * sep * scale;
    let ly = valign === 1 ? y - total / 2 : valign === 2 ? y - total : y;
    for (const line of lines) {
      const w = lineWidth(line) * scale;
      let px = halign === 1 ? x - w / 2 : halign === 2 ? x - w : x;
      const top = Math.round(ly);
      for (let i = 0; i < line.length; i++) {
        const [gx, gy, gw, gh, shift, offset] = glyph(line[i]);
        if (gw > 0 && gh > 0) this.ctx.drawImage(tex, gx, gy, gw, gh, Math.round(px + offset * scale), top, gw * scale, gh * scale);
        px += shift * scale;
      }
      ly += sep * scale;
    }
  }

  draw(list: DrawList): void {
    const ctx = this.ctx;
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    for (const c of list) {
      switch (c[0]) {
        case Cmd.Sprite: {
          if (!this.atlas) break;
          const f = this.frames[c[1] as number]?.[c[2] as number];
          if (!f || f[2] === 0) break;
          ctx.drawImage(this.atlas, f[0], f[1], f[2], f[3], (c[3] as number) + f[4], (c[4] as number) + f[5], f[2], f[3]);
          break;
        }
        case Cmd.Rect:
          ctx.fillStyle = css(c[5] as number);
          ctx.fillRect(c[1] as number, c[2] as number, c[3] as number, c[4] as number);
          break;
        case Cmd.AlphaRect:
          ctx.globalAlpha = (c[6] as number) / 255;
          ctx.fillStyle = css(c[5] as number);
          ctx.fillRect(c[1] as number, c[2] as number, c[3] as number, c[4] as number);
          ctx.globalAlpha = 1;
          break;
        case Cmd.Text:
          this.text(c[1] as number, c[2] as number, c[3] as string, c[4] as number, c[5] as number, c[6] as number, c[7] as number, c[8] as number);
          break;
      }
    }
  }
}

/** Largest size for a 320x200 (or 4:3) screen inside a box, in CSS pixels. */
export function fitScreen(availW: number, availH: number, aspect: number, dpr: number, integer: boolean): { w: number; h: number } {
  let w = Math.min(availW, availH * aspect);
  if (integer) {
    const scale = Math.floor((w * dpr) / SCREEN_W);
    if (scale >= 1) w = (scale * SCREEN_W) / dpr;
  }
  w = Math.max(1, Math.floor(w * dpr) / dpr);
  return { w, h: Math.floor((w / aspect) * dpr) / dpr };
}
