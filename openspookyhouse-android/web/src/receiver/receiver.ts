// The TV side. Runs as a Google Cast Web Receiver on a Chromecast, or inside
// a WebView on a secondary display (Android Presentation, `?local=1`).
// It never runs game logic: it caches the sprite atlas sent by the phone and
// draws the frames it receives.
import { AtlasMeta } from '../assets/build';
import { NAMESPACE, PROTOCOL, ReceiverMessage, SenderMessage } from '../cast/protocol';
import { DrawList } from '../render/drawlist';
import { fitScreen, Renderer } from '../render/renderer';
import { titleScreen } from '../ui/titleScreen';

declare global {
  interface Window {
    cast?: any;
    __oshReceive?: (json: string) => void;
    /** Native reply channel when running on a local secondary display. */
    OSHDisplay?: { reply(json: string): void };
    /** Test hook for the reply channel. */
    __oshReply?: (json: string) => void;
  }
}

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const renderer = new Renderer(canvas, 'font.png');
const local = new URLSearchParams(location.search).has('local');

let aspect = 1.6;
let atlasHash: string | null = null;
let pending: { hash: string; meta: AtlasMeta; n: number; parts: string[]; got: number } | null = null;
let frame: DrawList | null = null;
let status = 'Waiting for your phone…';
let progress = 0;
let dirty = true;
let lastSender: string | undefined;

// ---- Transport ----

let castContext: any = null;

function reply(msg: ReceiverMessage, senderId = lastSender): void {
  const json = JSON.stringify(msg);
  if (castContext) castContext.sendCustomMessage(NAMESPACE, senderId, msg);
  else if (window.OSHDisplay) window.OSHDisplay.reply(json);
  else window.__oshReply?.(json);
}

// ---- Atlas cache (the sprites stay on the TV between sessions) ----

const CACHE_KEY = 'osh-atlas';

async function applyAtlas(hash: string, meta: AtlasMeta, png: string): Promise<void> {
  const img = new Image();
  img.src = 'data:image/png;base64,' + png;
  await img.decode();
  renderer.setAtlas(img, meta.sprites.map((s) => s.f));
  atlasHash = hash;
  dirty = true;
}

const cacheReady: Promise<void> = (async () => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const c = JSON.parse(raw);
    await applyAtlas(c.hash, c.meta, c.png);
  } catch {
    atlasHash = null;
  }
})();

// ---- Messages ----

async function handle(msg: SenderMessage, senderId?: string): Promise<void> {
  if (senderId) lastSender = senderId;
  switch (msg.t) {
    case 'hello':
      aspect = msg.cfg?.aspect || 1.6;
      layout();
      await cacheReady;
      status = msg.hash ? 'Connected' : 'Connected – waiting for game files on your phone';
      dirty = true;
      reply({ t: 'ready', v: PROTOCOL, have: atlasHash }, senderId);
      break;
    case 'cfg':
      aspect = msg.cfg.aspect || 1.6;
      layout();
      break;
    case 'atlas':
      pending = { hash: msg.hash, meta: msg.meta, n: msg.n, parts: new Array(msg.n), got: 0 };
      status = 'Receiving sprites';
      progress = 0;
      frame = null;
      dirty = true;
      break;
    case 'chunk': {
      const p = pending;
      if (!p || p.hash !== msg.hash || p.parts[msg.i] !== undefined) return;
      p.parts[msg.i] = msg.d;
      p.got++;
      progress = p.got / p.n;
      dirty = true;
      if (p.got < p.n) return;
      pending = null;
      const png = p.parts.join('');
      try {
        await applyAtlas(p.hash, p.meta, png);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ hash: p.hash, meta: p.meta, png }));
        } catch {
          /* storage full: just re-receive next time */
        }
        status = 'Connected';
        reply({ t: 'atlas-ok', hash: p.hash }, senderId);
      } catch {
        reply({ t: 'need-atlas', hash: p.hash }, senderId);
      }
      break;
    }
    case 'f':
      frame = msg.d;
      dirty = true;
      break;
    case 'bye':
      frame = null;
      status = 'Waiting for your phone…';
      dirty = true;
      break;
  }
}

window.__oshReceive = (json: string) => {
  try {
    void handle(JSON.parse(json));
  } catch {
    /* ignore malformed messages */
  }
};

// ---- Drawing ----

function layout(): void {
  const size = fitScreen(window.innerWidth, window.innerHeight, aspect, window.devicePixelRatio || 1, false);
  canvas.style.width = size.w + 'px';
  canvas.style.height = size.h + 'px';
}
window.addEventListener('resize', layout);
layout();

function draw(): void {
  requestAnimationFrame(draw);
  if (!dirty || !renderer.ready) return;
  dirty = false;
  if (frame && atlasHash) renderer.draw(frame);
  else renderer.draw(titleScreen(status, pending ? 1 : 0, pending ? progress : 0));
}
requestAnimationFrame(draw);

// ---- Cast Application Framework ----

function startCast(): void {
  const framework = window.cast?.framework;
  if (!framework) return;
  castContext = framework.CastReceiverContext.getInstance();
  castContext.addCustomMessageListener(NAMESPACE, (event: { data: SenderMessage | string; senderId: string }) => {
    const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    void handle(data, event.senderId);
  });
  castContext.addEventListener(framework.system.EventType.SENDER_CONNECTED, (event: { senderId: string }) => {
    lastSender = event.senderId;
    status = 'Connected';
    dirty = true;
  });
  const options = new framework.CastReceiverOptions();
  options.customNamespaces = { [NAMESPACE]: framework.system.MessageType.JSON };
  // A game is not a media session: keep running while idle
  options.disableIdleTimeout = true;
  options.skipPlayersLoad = true;
  options.statusText = 'OpenSpookyHouse';
  castContext.start(options);
}

if (!local) {
  const s = document.createElement('script');
  s.src = 'https://www.gstatic.com/cast/sdk/libs/caf_receiver/v3/cast_receiver_framework.js';
  s.onload = startCast;
  document.head.appendChild(s);
}
