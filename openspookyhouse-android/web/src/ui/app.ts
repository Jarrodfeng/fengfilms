// The phone app: game-file import, title menu, the 60 Hz game loop, touch
// and keyboard input, autosave, settings and casting.
import { buildAssets, BuiltAssets, checkFiles, Pixels, usefulFileNames, AssetFiles } from '../assets/build';
import { loadStoredFiles, storeFiles } from '../assets/store';
import { isZip, unzip } from '../assets/zip';
import { native } from '../cast/bridge';
import { CastSender } from '../cast/sender';
import { GameSession, UiState, VK } from '../game/session';
import { GameState } from '../game/state';
import { setPlatform, platform } from '../game/platform';
import { BUILTIN_SPRITES } from '../game/data.generated';
import { setSpriteTable } from '../game/sprites';
import { DrawList } from '../render/drawlist';
import { fitScreen, Renderer } from '../render/renderer';
import { titleScreen } from './titleScreen';

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

interface UiSettings {
  aspect: number;
  scaling: 'fill' | 'integer';
  haptics: boolean;
  verbs: boolean;
}

const settings: UiSettings = { aspect: 1.6, scaling: 'fill', haptics: true, verbs: true };
try {
  Object.assign(settings, JSON.parse(platform.load('ui-settings') || '{}'));
} catch {
  /* defaults */
}
const saveSettings = () => platform.save('ui-settings', JSON.stringify(settings));

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const app = $('app');
const canvas = $<HTMLCanvasElement>('screen');
const stage = $('stage');
const cmd = $<HTMLInputElement>('cmd');
const cmdRow = $<HTMLFormElement>('cmdrow');
const verbs = $('verbs');
const context = $('context');
const titleStatus = $('titleStatus');
const titleButtons = $('titleButtons');
const fileInput = $<HTMLInputElement>('fileInput');
const castBtn = $<HTMLButtonElement>('castBtn');
const castBadge = $('castBadge');
const dialog = $<HTMLDialogElement>('settings');

const renderer = new Renderer(canvas, 'font.png');
const session = new GameSession();

setPlatform({
  quit: () => {
    if (native) native.quit();
    else showTitle('Thanks for playing!');
  },
  setFullscreen: (on) => native?.setFullscreen(on),
});

function haptic(): void {
  if (settings.haptics) native?.haptic();
}

// ---------------------------------------------------------------------------
// Casting
// ---------------------------------------------------------------------------

const cast = new CastSender(updateCastUi);
cast.setConfig({ aspect: settings.aspect });

window.__osh = {
  onCastState: (state, device) => cast.setState(state, device),
  onCastMessage: (json) => cast.onMessage(json),
  onBack: () => onBack(),
};

function updateCastUi(): void {
  const s = cast.state;
  castBtn.hidden = !native || s === 'UNAVAILABLE';
  castBtn.classList.toggle('connected', cast.connected);
  castBtn.classList.toggle('connecting', s === 'CONNECTING');
  castBtn.classList.toggle('off', s === 'NO_DEVICES');
  castBadge.hidden = !cast.live;
  castBadge.textContent = s === 'DISPLAY' ? 'On display' : 'On TV';
  castBtn.title = cast.connected ? 'Casting to ' + (cast.device || 'TV') : s === 'NO_DEVICES' ? 'No Chromecast found on this Wi-Fi' : 'Cast to TV';
}

castBtn.addEventListener('click', () => {
  haptic();
  if (!native) return;
  if (!native.getCastAppId()) {
    openSettings();
    $<HTMLInputElement>('setCastId').focus();
    return;
  }
  native.openCastDialog();
});

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

let assets: BuiltAssets | null = null;
let atlasCanvas: HTMLCanvasElement | null = null;
let atlasPng: string | null = null;

async function loadMasks(): Promise<Record<string, Pixels>> {
  const out: Record<string, Pixels> = {};
  const names = Object.keys(BUILTIN_SPRITES).filter((n) => n.startsWith('spr_mask_'));
  await Promise.all(
    names.map(async (name) => {
      const img = new Image();
      img.src = 'masks/' + name + '.png';
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const x = c.getContext('2d', { willReadFrequently: true })!;
      x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height);
      out[name] = { width: d.width, height: d.height, data: d.data };
    }),
  );
  return out;
}

let masksPromise: Promise<Record<string, Pixels>> | null = null;

async function useFiles(files: AssetFiles): Promise<boolean> {
  const check = checkFiles(files);
  if (!check.kind) return false;
  masksPromise ??= loadMasks();
  const masks = await masksPromise;
  const built = await buildAssets(files, masks, (p, label) => showScreen(titleScreen('Loading\n' + label, 0.5, p)));
  if (built.warnings.length) console.warn(built.warnings.join('\n'));
  assets = built;
  const c = document.createElement('canvas');
  c.width = built.atlas.width;
  c.height = built.atlas.height;
  c.getContext('2d')!.putImageData(new ImageData(built.atlas.data as Uint8ClampedArray<ArrayBuffer>, built.atlas.width, built.atlas.height), 0, 0);
  atlasCanvas = c;
  atlasPng = null;
  renderer.setAtlas(c, built.meta.sprites.map((s) => s.f));
  setSpriteTable(built.table);
  cast.setAssets({
    hash: built.hash,
    meta: built.meta,
    png: async () => (atlasPng ??= atlasCanvas!.toDataURL('image/png').split(',')[1]),
  });
  return true;
}

async function readPicked(list: FileList): Promise<AssetFiles> {
  const useful = usefulFileNames();
  const files: AssetFiles = new Map();
  for (const f of Array.from(list)) {
    const data = new Uint8Array(await f.arrayBuffer());
    if (isZip(data)) {
      const inner = await unzip(data, (n) => useful.has(n.toUpperCase()));
      for (const [n, d] of inner) files.set(n.toUpperCase(), d);
    } else {
      const name = f.name.split(/[\\/]/).pop()!.toUpperCase();
      if (useful.has(name)) files.set(name, data);
    }
  }
  return files;
}

fileInput.addEventListener('change', async () => {
  if (!fileInput.files || fileInput.files.length === 0) return;
  setTitleStatus('Reading files…');
  try {
    const picked = await readPicked(fileInput.files);
    fileInput.value = '';
    // Combine with what was imported before (handy for many .PIX files)
    const existing = await loadStoredFiles();
    const merged: AssetFiles = new Map([...existing, ...picked]);
    const pickedCheck = checkFiles(picked);
    const files = pickedCheck.kind ? picked : merged;
    const check = checkFiles(files);
    if (!check.kind) {
      await storeFiles(merged, false);
      const shown = check.missing.slice(0, 12).join(', ') + (check.missing.length > 12 ? '…' : '');
      setTitleStatus(
        picked.size === 0
          ? 'None of those are Hugo’s House of Horrors game files.'
          : 'Still missing: ' + shown,
        true,
      );
      return;
    }
    await storeFiles(files, true);
    setTitleStatus('Preparing sprites…');
    await useFiles(files);
    showMenu();
  } catch (e) {
    console.error(e);
    setTitleStatus('Could not read those files: ' + (e as Error).message, true);
  }
});

// ---------------------------------------------------------------------------
// Title screen
// ---------------------------------------------------------------------------

let playing = false;
let titleList: DrawList = titleScreen('');

function setMode(mode: string): void {
  app.className = app.className.replace(/\bmode-\S+/g, '').trim() + ' mode-' + mode;
  layout();
}

function showScreen(list: DrawList): void {
  titleList = list;
  renderer.draw(list);
}

function setTitleStatus(text: string, error = false): void {
  titleStatus.textContent = text;
  titleStatus.classList.toggle('error', error);
}

function button(label: string, cls: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'key ' + cls;
  b.textContent = label;
  b.addEventListener('click', () => {
    haptic();
    onClick();
  });
  return b;
}

function loadAutosave(): GameState | null {
  try {
    const raw = platform.load('autosave');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function showTitle(message = ''): void {
  playing = false;
  native?.setKeepScreenOn(false);
  cmd.blur();
  setMode('title');
  if (assets) showMenu(message);
  else showImport();
}

function showImport(): void {
  setMode('title');
  showScreen(titleScreen("Hugo's House of Horrors\ngame files required."));
  setTitleStatus('OpenSpookyHouse needs the graphics from your own copy of Hugo’s House of Horrors.');
  titleButtons.replaceChildren(button('Choose game files', 'primary', () => fileInput.click()));
  $<HTMLDetailsElement>('filesHelp').open = true;
}

function showMenu(message = ''): void {
  setMode('title');
  showScreen(titleScreen(message || 'Enjoy!', 1));
  const save = loadAutosave();
  setTitleStatus(message ? message : assets?.kind === 'dat' ? 'Game files: GOG version' : 'Game files: DOS version');
  const buttons: HTMLButtonElement[] = [];
  if (save) buttons.push(button('Continue', 'primary', () => startGame(save)));
  buttons.push(button('New game', save ? '' : 'primary', () => startGame(null)));
  buttons.push(button('Settings', '', openSettings));
  titleButtons.replaceChildren(...buttons);
  $<HTMLDetailsElement>('filesHelp').open = false;
}

function startGame(save: GameState | null): void {
  if (!assets) return;
  try {
    if (save) session.continueFrom(save);
    else session.newGame();
  } catch (e) {
    console.error(e);
    platform.remove('autosave');
    session.newGame();
  }
  playing = true;
  native?.setKeepScreenOn(true);
  setMode('play');
  last = performance.now();
  acc = 0;
}

session.onEnd = () => {
  const finished = session.game.room === 'rm_theend';
  platform.remove('autosave');
  if (finished) showTitle('Thank you for playing!');
  else platform.quit();
};

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

let ui: UiState | null = null;

function press(vk: number): void {
  if (!playing) return;
  session.pressKey(vk);
}

for (const b of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-key]'))) {
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    haptic();
    press(Number(b.dataset.key));
  });
}
document.querySelector('[data-stop]')!.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  haptic();
  const dir = ui?.walking;
  if (dir) press({ left: VK.left, right: VK.right, up: VK.up, down: VK.down }[dir]);
});

cmdRow.addEventListener('submit', (e) => {
  e.preventDefault();
  haptic();
  press(VK.enter);
});

cmd.addEventListener('input', () => {
  if (ui && ui.textTarget !== 'none') session.setText(cmd.value);
});
cmd.addEventListener('focus', () => app.classList.add('typing'));
cmd.addEventListener('blur', () => {
  app.classList.remove('typing');
  layout();
});

// Tapping the picture continues a message
canvas.addEventListener('pointerdown', () => {
  if (!playing || !ui) return;
  if (ui.mode === 'message' || ui.mode === 'question') press(VK.enter);
});

const VERBS: [string, string | null][] = [
  ['look', null],
  ['look at', 'look at '],
  ['take', 'take '],
  ['open', 'open '],
  ['use', 'use '],
  ['on', 'on '],
  ['inspect', 'inspect '],
  ['talk to', 'talk to '],
  ['give', 'give '],
  ['push', 'push '],
  ['knock on', 'knock on '],
  ['inventory', null],
];
for (const [label, insert] of VERBS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.addEventListener('click', () => {
    haptic();
    if (!ui || ui.textTarget !== 'command') return;
    if (insert === null) {
      // Complete commands run straight away
      session.setText(label);
      press(VK.enter);
      return;
    }
    const current = cmd.value.trim();
    const next = (current === '' || insert === 'on ' ? (current ? current + ' ' : '') : '') + insert;
    cmd.value = next;
    session.setText(next);
    cmd.focus();
  });
  verbs.appendChild(b);
}

const KEYMAP: Record<string, number> = {
  ArrowLeft: VK.left,
  ArrowUp: VK.up,
  ArrowRight: VK.right,
  ArrowDown: VK.down,
  Escape: VK.escape,
  F1: VK.f1,
  F2: VK.f2,
  F3: VK.f3,
  F4: VK.f4,
  F5: VK.f5,
  F6: VK.f6,
  F11: VK.f11,
};

document.addEventListener('keydown', (e) => {
  if (!playing || dialog.open) return;
  const vk = KEYMAP[e.key];
  if (vk !== undefined) {
    e.preventDefault();
    press(vk);
    return;
  }
  if (e.key === 'Enter' && document.activeElement !== cmd) {
    e.preventDefault();
    press(VK.enter);
    return;
  }
  if (ui?.mode === 'quit' && (e.key === 'y' || e.key === 'Y' || e.key === 'n' || e.key === 'N')) {
    e.preventDefault();
    press(e.key.toLowerCase() === 'y' ? VK.y : VK.n);
    return;
  }
  // Letters typed anywhere go to the command line
  if (e.key.length === 1 && document.activeElement !== cmd && ui?.textTarget !== 'none' && !e.ctrlKey && !e.metaKey) cmd.focus();
});

function onBack(): void {
  if (dialog.open) {
    dialog.close();
    return;
  }
  if (!playing) {
    native?.quit();
    return;
  }
  if (document.activeElement === cmd) {
    cmd.blur();
    return;
  }
  press(VK.escape);
}

// Context buttons follow what the game is showing
let contextKey = '';
function updateContext(state: UiState): void {
  const key = state.mode + (state.morePages ? '+' : '');
  if (key === contextKey) return;
  contextKey = key;
  const k = (label: string, vk: number, cls = '') => button(label, cls, () => press(vk));
  let items: HTMLButtonElement[];
  switch (state.mode) {
    case 'quit':
      items = [k('Yes, quit', VK.y, 'danger'), k('No', VK.n, 'primary')];
      break;
    case 'message':
    case 'question':
      items = [k(state.morePages ? 'Next ⏎' : 'OK ⏎', VK.enter, 'primary'), k('Close (Esc)', VK.escape)];
      break;
    case 'menu-save':
    case 'menu-restore':
      items = [k('Select ⏎', VK.enter, 'primary'), k('Cancel (Esc)', VK.escape)];
      break;
    case 'save-name':
      items = [k('Save ⏎', VK.enter, 'primary'), k('Cancel (Esc)', VK.escape)];
      break;
    case 'options':
      items = [k('◀', VK.left), k('▶', VK.right), k('Save ⏎', VK.enter, 'primary'), k('Esc', VK.escape)];
      break;
    default:
      items = [k('Enter ⏎', VK.enter, 'primary'), k('Esc (Quit)', VK.escape)];
  }
  context.replaceChildren(...items);
}

function syncUi(state: UiState): void {
  updateContext(state);
  // Mirror the game's text into the box, but don't fight the keyboard while
  // the player is typing (the box may hold characters the game filters out).
  const typed = cmd.value.replace(/[^A-Za-z0-9 ]/g, '');
  if (document.activeElement !== cmd ? cmd.value !== state.text : typed !== state.text) cmd.value = state.text;
  cmd.placeholder = state.textTarget === 'savename' ? 'Name this save…' : state.mode === 'play' ? 'Type a command…' : '';
  for (const b of Array.from(document.querySelectorAll<HTMLButtonElement>('#dpad [data-key]'))) {
    const dir = { '37': 'left', '38': 'up', '39': 'right', '40': 'down' }[b.dataset.key!];
    b.classList.toggle('walking', state.walking === dir);
  }
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

function layout(): void {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const landscape = vw > vh * 1.15;
  app.classList.toggle('landscape', landscape);
  app.classList.toggle('portrait', !landscape);
  app.classList.toggle('no-verbs', !settings.verbs);
  const dpr = window.devicePixelRatio || 1;
  let availW: number;
  let availH: number;
  if (landscape) {
    const typing = app.classList.contains('typing');
    const bottom = (cmdRow.offsetHeight || 54) + (settings.verbs ? 0 : 0);
    availW = typing ? vw : vw - 2 * 150;
    availH = vh - bottom;
  } else {
    availW = vw;
    const reserve = app.classList.contains('mode-title') ? 0.55 : app.classList.contains('typing') ? 0.4 : 0.5;
    availH = vh * reserve;
  }
  const size = fitScreen(availW, availH, settings.aspect, dpr, settings.scaling === 'integer');
  app.style.setProperty('--stage-w', size.w + 'px');
  app.style.setProperty('--stage-h', size.h + 'px');
  stage.style.height = landscape ? '' : size.h + 'px';
}

window.addEventListener('resize', layout);
window.visualViewport?.addEventListener('resize', layout);

// ---------------------------------------------------------------------------
// Settings dialog
// ---------------------------------------------------------------------------

function openSettings(): void {
  $<HTMLSelectElement>('setAspect').value = String(settings.aspect === 1.6 ? '1.6' : '1.3333333333');
  $<HTMLSelectElement>('setScaling').value = settings.scaling;
  $<HTMLInputElement>('setHaptics').checked = settings.haptics;
  $<HTMLInputElement>('setVerbs').checked = settings.verbs;
  $('castSettings').hidden = !native;
  if (native) $<HTMLInputElement>('setCastId').value = native.getCastAppId();
  $('setTitle').hidden = !playing;
  $('aboutText').textContent =
    'OpenSpookyHouse © Logan Baron, GPL-3.0. Android port ' + (native ? native.appVersion() : 'web') + '. Hugo’s House of Horrors © David P. Gray / Gray Design Associates.';
  if (!dialog.open) dialog.showModal();
}

$('menuBtn').addEventListener('click', () => {
  haptic();
  openSettings();
});

dialog.addEventListener('close', () => {
  settings.aspect = Number($<HTMLSelectElement>('setAspect').value) > 1.5 ? 1.6 : 4 / 3;
  settings.scaling = $<HTMLSelectElement>('setScaling').value === 'integer' ? 'integer' : 'fill';
  settings.haptics = $<HTMLInputElement>('setHaptics').checked;
  settings.verbs = $<HTMLInputElement>('setVerbs').checked;
  saveSettings();
  cast.setConfig({ aspect: settings.aspect });
  if (native) {
    const id = $<HTMLInputElement>('setCastId').value.trim().toUpperCase();
    if (id !== native.getCastAppId()) native.setCastAppId(id);
  }
  layout();
});

$('setFiles').addEventListener('click', () => {
  dialog.close();
  if (playing) autosave();
  playing = false;
  setMode('title');
  showImport();
});

$('setTitle').addEventListener('click', () => {
  dialog.close();
  autosave();
  showTitle();
});

// ---------------------------------------------------------------------------
// Autosave (Android may stop the app while it is in the background)
// ---------------------------------------------------------------------------

function autosave(): void {
  if (!playing) return;
  const snap = session.snapshot();
  if (snap) platform.save('autosave', JSON.stringify(snap));
  else platform.remove('autosave');
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) autosave();
  else last = performance.now();
});
window.addEventListener('pagehide', autosave);

// ---------------------------------------------------------------------------
// Main loop: fixed 60 steps per second, rendering only when something ran
// (so 120 Hz displays don't redraw identical frames).
// ---------------------------------------------------------------------------

const STEP = 1000 / 60;
let last = performance.now();
let acc = 0;
/** Automated tests drive the game step by step instead of in real time. */
let manual = false;

function present(now: number): void {
  const list = session.render();
  renderer.draw(list);
  cast.frame(list, now);
  ui = session.uiState();
  syncUi(ui);
}

function frame(now: number): void {
  requestAnimationFrame(frame);
  if (document.hidden || manual) return;
  if (!playing) {
    // Mirror the title screen on the TV
    cast.screen(titleList, now);
    return;
  }
  acc += Math.min(now - last, 250);
  last = now;
  let stepped = 0;
  while (acc >= STEP && stepped < 8) {
    session.tick();
    acc -= STEP;
    stepped++;
    if (!playing) return;
  }
  if (stepped === 0) return;
  present(now);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

async function boot(): Promise<void> {
  layout();
  updateCastUi();
  showScreen(titleScreen('Loading…'));
  await document.fonts?.ready;
  const files = await loadStoredFiles();
  let ok = false;
  try {
    ok = await useFiles(files);
  } catch (e) {
    console.error(e);
  }
  if (ok) showMenu();
  else showImport();
  requestAnimationFrame(frame);
}

void boot();

// Exposed for automated tests
import { g } from '../game/state';
(window as any).__oshTest = {
  session,
  g,
  cast,
  useFiles,
  startGame,
  get assets() {
    return assets;
  },
  get playing() {
    return playing;
  },
  /** Stop real-time stepping and run `n` steps immediately. */
  run(n: number) {
    manual = true;
    for (let i = 0; i < n && playing; i++) session.tick();
    if (playing) present(performance.now() + 10000);
    return session.uiState();
  },
  setManual(on: boolean) {
    manual = on;
  },
};
