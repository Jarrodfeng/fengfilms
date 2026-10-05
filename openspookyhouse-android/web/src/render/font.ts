// Metrics for fnt_cmd (Press Start 2P, 6pt as configured in OpenSpookyHouse).
// Shared by the game (for wrapping / measuring) and the renderers.
import { FONT } from '../game/data.generated';

type Glyph = [number, number, number, number, number, number]; // x, y, w, h, shift, offset

const glyphs = FONT.glyphs as Record<string, Glyph>;
const fallback: Glyph = glyphs['63'] /* '?' */;

/** font_get_size(fnt_cmd) */
export const FONT_SIZE = FONT.size;
/** Default line separation used by draw_text when no separation is given. */
export const FONT_LINE = 9;

export function glyph(ch: string): Glyph {
  return glyphs[ch.charCodeAt(0)] || fallback;
}

/** Width of a single line in pixels (sum of glyph advances). */
export function lineWidth(line: string): number {
  let w = 0;
  for (let i = 0; i < line.length; i++) w += glyph(line[i])[4];
  return w;
}

/** string_width: widest line. */
export function stringWidth(text: string): number {
  let max = 0;
  for (const line of text.split('\n')) max = Math.max(max, lineWidth(line));
  return max;
}

/**
 * Word-wraps text the way draw_text_ext does: explicit newlines are kept and
 * words are moved to the next line when a line would exceed `width` pixels.
 */
export function wrapText(text: string, width: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    if (lineWidth(para) <= width) {
      out.push(para);
      continue;
    }
    const words = para.split(' ');
    let line = '';
    for (const word of words) {
      const candidate = line === '' ? word : line + ' ' + word;
      if (line !== '' && lineWidth(candidate) > width) {
        out.push(line);
        line = word;
      } else {
        line = candidate;
      }
      // A single word wider than the box is broken by characters.
      while (lineWidth(line) > width && line.length > 1) {
        let cut = line.length - 1;
        while (cut > 1 && lineWidth(line.slice(0, cut)) > width) cut--;
        out.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    out.push(line);
  }
  return out;
}

/** string_width_ext */
export function stringWidthExt(text: string, width: number): number {
  let max = 0;
  for (const l of wrapText(text, width)) max = Math.max(max, lineWidth(l));
  return max;
}

/** string_height_ext */
export function stringHeightExt(text: string, sep: number, width: number): number {
  return wrapText(text, width).length * sep;
}
