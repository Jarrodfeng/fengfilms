// Phone side of casting: hands the sprite atlas to the TV once, then streams
// each frame's draw list. The game always runs on the phone; the TV is a
// display, so saves, input and timing stay local and latency stays low.
import { AtlasMeta } from '../assets/build';
import { DrawList } from '../render/drawlist';
import { native } from './bridge';
import { CHUNK, MAX_MESSAGE, PROTOCOL, ReceiverMessage, ScreenConfig, SenderMessage } from './protocol';

/** Minimum time between frame messages (about 30 per second). */
const FRAME_INTERVAL = 33;
/** Resend an unchanged frame this often, in case the TV reloaded. */
const KEEPALIVE = 1000;

export interface CastAssets {
  hash: string;
  meta: AtlasMeta;
  png: () => Promise<string>; // base64 PNG without the data: prefix
}

export class CastSender {
  state = native ? native.castState() : 'UNAVAILABLE';
  device = '';
  private assets: CastAssets | null = null;
  private ready = false;
  private sendingAtlas: string | null = null;
  private lastJson = '';
  private lastSent = 0;
  private cfg: ScreenConfig = { aspect: 1.6 };

  constructor(private readonly onChange: () => void) {}

  get connected(): boolean {
    return this.state === 'CONNECTED' || this.state === 'DISPLAY';
  }

  /** True once the TV is showing the game. */
  get live(): boolean {
    return this.connected && this.ready;
  }

  private transport(json: string): void {
    if (json.length > MAX_MESSAGE) return;
    if (native) native.castSend(json);
    else window.__oshDevCast?.send(json);
  }

  private send(msg: SenderMessage): void {
    this.transport(JSON.stringify(msg));
  }

  setAssets(assets: CastAssets | null): void {
    this.assets = assets;
    this.ready = false;
    this.sendingAtlas = null;
    if (this.connected) this.hello();
  }

  setConfig(cfg: ScreenConfig): void {
    this.cfg = cfg;
    if (this.connected) this.send({ t: 'cfg', cfg });
  }

  setState(state: string, device: string): void {
    const was = this.connected;
    this.state = state;
    this.device = device;
    if (this.connected && !was) {
      this.ready = false;
      this.sendingAtlas = null;
      this.lastJson = '';
      this.hello();
    }
    if (!this.connected) this.ready = false;
    this.onChange();
  }

  private hello(): void {
    this.send({ t: 'hello', v: PROTOCOL, cfg: this.cfg, hash: this.assets?.hash ?? null });
  }

  onMessage(json: string): void {
    let msg: ReceiverMessage;
    try {
      msg = JSON.parse(json);
    } catch {
      return;
    }
    switch (msg.t) {
      case 'ready':
        if (!this.assets) return;
        if (msg.have === this.assets.hash) this.markReady();
        else void this.sendAtlas();
        this.send({ t: 'cfg', cfg: this.cfg });
        break;
      case 'need-atlas':
        this.sendingAtlas = null;
        void this.sendAtlas();
        break;
      case 'atlas-ok':
        if (this.assets && msg.hash === this.assets.hash) this.markReady();
        break;
    }
  }

  private markReady(): void {
    this.ready = true;
    this.sendingAtlas = null;
    this.lastJson = '';
    this.onChange();
  }

  private async sendAtlas(): Promise<void> {
    const a = this.assets;
    if (!a || this.sendingAtlas === a.hash) return;
    this.sendingAtlas = a.hash;
    const png = await a.png();
    const n = Math.ceil(png.length / CHUNK);
    this.send({ t: 'atlas', hash: a.hash, meta: a.meta, n });
    for (let i = 0; i < n; i++) {
      if (this.sendingAtlas !== a.hash || !this.connected) return;
      this.send({ t: 'chunk', hash: a.hash, i, d: png.slice(i * CHUNK, (i + 1) * CHUNK) });
      // Let the channel breathe between chunks
      await new Promise((r) => setTimeout(r, 15));
    }
  }

  /** Called for every rendered frame; sends it if it changed. */
  frame(list: DrawList, now: number): void {
    if (!this.live) return;
    if (now - this.lastSent < FRAME_INTERVAL) return;
    const json = JSON.stringify({ t: 'f', d: list } satisfies SenderMessage);
    if (json === this.lastJson && now - this.lastSent < KEEPALIVE) return;
    this.lastJson = json;
    this.lastSent = now;
    this.transport(json);
  }

  /** Shows a non-game screen (title / loading) on the TV. */
  screen(list: DrawList, now: number): void {
    this.frame(list, now);
  }
}
