// Messages exchanged between the phone (sender) and the TV (receiver) over
// the Cast custom namespace, or over the local bridge for a wired / Miracast
// secondary display. Each message is one JSON string under 64 KB (the Cast
// channel's MAX_MESSAGE_LENGTH).
import { AtlasMeta } from '../assets/build';
import { DrawList } from '../render/drawlist';

export const NAMESPACE = 'urn:x-cast:com.openspookyhouse.game';
export const PROTOCOL = 1;
/** Base64 characters per atlas chunk; leaves room for the JSON envelope. */
export const CHUNK = 48000;
export const MAX_MESSAGE = 60000;

export interface ScreenConfig {
  /** Width / height of the picture: 1.6 (square pixels) or 4/3 (DOS-style). */
  aspect: number;
}

export type SenderMessage =
  | { t: 'hello'; v: number; cfg: ScreenConfig; hash: string | null }
  | { t: 'atlas'; hash: string; meta: AtlasMeta; n: number }
  | { t: 'chunk'; hash: string; i: number; d: string }
  | { t: 'cfg'; cfg: ScreenConfig }
  | { t: 'f'; d: DrawList }
  | { t: 'bye' };

export type ReceiverMessage =
  | { t: 'ready'; v: number; have: string | null }
  | { t: 'need-atlas'; hash: string }
  | { t: 'atlas-ok'; hash: string };
