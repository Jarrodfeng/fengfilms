// A frame is described as a flat list of draw commands. The same list is
// rendered locally on the phone and sent verbatim to a Chromecast (or a
// secondary display), so both screens always show exactly the same picture.

export const enum Cmd {
  /** [Cmd.Sprite, spriteId, frame, x, y] - x/y are the frame's top-left corner. */
  Sprite = 0,
  /** [Cmd.Rect, x, y, w, h, rgb] */
  Rect = 1,
  /** [Cmd.Text, x, y, text, rgb, halign, valign, sep, scale] - text is pre-wrapped. */
  Text = 2,
  /** [Cmd.AlphaRect, x, y, w, h, rgb, alpha(0-255)] - debug overlays. */
  AlphaRect = 3,
}

export const enum HAlign {
  Left = 0,
  Center = 1,
  Right = 2,
}

export const enum VAlign {
  Top = 0,
  Middle = 1,
  Bottom = 2,
}

export type DrawCmd = (number | string)[];
export type DrawList = DrawCmd[];

export const SCREEN_W = 320;
export const SCREEN_H = 200;

/** GameMaker colour constants (converted from BGR to 0xRRGGBB). */
export const C = {
  black: 0x000000,
  white: 0xffffff,
  yellow: 0xffff00,
  purple: 0x800080,
  green: 0x008000,
  red: 0xff0000,
  cyan: 0x55ffff, // global.c_cyan = make_color_rgb(85, 255, 255)
  msgBorder: 0xff5555, // global.c_msgborder = make_color_rgb(255, 85, 85)
};
