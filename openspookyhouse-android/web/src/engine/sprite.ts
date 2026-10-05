// Runtime sprite model. Mirrors what OpenSpookyHouse builds in GameMaker with
// sprite_create_from_surface / sprite_merge / sprite_collision_mask.

export interface FrameRect {
  /** Position of the (cropped) frame inside the atlas. */
  ax: number;
  ay: number;
  /** Size of the cropped region. */
  w: number;
  h: number;
  /** Offset of the cropped region inside the full frame. */
  dx: number;
  dy: number;
}

export interface BBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface Sprite {
  /** Index into the sprite table (stable for a given asset build). */
  id: number;
  name: string;
  width: number;
  height: number;
  xorigin: number;
  yorigin: number;
  /** Inclusive pixel bounds relative to the sprite's top-left corner. */
  bbox: BBox;
  /** Animation speed in frames per second (spritespeed_framespersecond). */
  speed: number;
  frames: FrameRect[];
  /** Per-pixel collision mask for "precise" sprites (frame 0 only). */
  precise?: Uint8Array;
  /** Debug sprites have no pixels; they are drawn as translucent rectangles. */
  debugColor?: number;
}

export const NO_SPRITE = null;
