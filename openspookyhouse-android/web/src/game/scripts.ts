// Ports of the OpenSpookyHouse scripts/ folder (scr_*).
import {
  g,
  FLAGS,
  MSG_MESSAGE,
  MSG_QUESTION,
  MSG_SAVE,
  MSG_SAVE_NAME,
  MSG_RESTORE,
  NO_ROOM,
  STATUS_DEAD,
  STATUS_HEADLESS,
  STATUS_NORMAL,
  SAVE_SLOTS,
  SAVE_LENGTH,
  MIN_OPTION_PADDING,
  OPTION_PADDING_CHAR,
  OPTIONS_ORDER,
  TEXT,
  GameState,
  RoomObjectState,
  defaultOptions,
} from './state';
import { getSprite, spriteName } from './sprites';
import { Player, StateBase, InteractBase } from './objects/core';
import { ITEMS } from './items';
import { platform } from './platform';

// ---- Messages ----

/** scr_show_message */
export function showMessage(msg: string, roomPrevious: string, msgState = MSG_MESSAGE, answerFunc: ((a: string) => void) | null = null): void {
  const game = g.game;
  g.msg_string = msg;
  g.msg_state = msgState;
  game.with(Player, (p) => {
    g.game_state.current_x = p.x;
    g.game_state.current_y = p.y;
    g.game_state.current_direction = spriteName(p.sprite);
    g.game_state.current_frame = p.imageIndex;
  });
  g.game_state.current_room = roomPrevious;
  g.transition = true;
  // The message room draws a "screenshot" of the room underneath the box.
  g.msg_screenshot = game.lastWorld.slice();
  g.question_response = msgState === MSG_QUESTION ? answerFunc : null;
  saveRoomState(roomPrevious);
  game.roomGoto('rm_message');
}

/** scr_ask_question */
export function askQuestion(msg: string, room: string, response: (answer: string) => void): void {
  showMessage(msg, room, MSG_QUESTION, response);
}

/** scr_show_inventory */
export function showInventory(roomPrevious: string): void {
  let msg = '';
  const keys = Object.keys(g.game_state.inventory);
  if (keys.length === 0) msg += TEXT.inventory_empty;
  else {
    msg += TEXT.inventory_header;
    for (const k of keys) {
      const item = ITEMS[k];
      if (item) msg += item.inventory + '\n';
    }
    msg += TEXT.inventory_footer;
  }
  showMessage(msg, roomPrevious);
}

/** scr_show_save_message */
export function showSaveMessage(room: string): void {
  if (g.game_state.dead) showMessage(TEXT.dead, room);
  else {
    g.save_load_index = 0;
    showMessage('', room, MSG_SAVE);
  }
}

/** scr_show_restore_message */
export function showRestoreMessage(room: string): void {
  g.save_load_index = 0;
  showMessage(TEXT.restore, room, MSG_RESTORE);
}

/** scr_can_input */
export function canInput(): boolean {
  return g.game.room !== 'rm_load' && g.game.room !== 'rm_message';
}

// ---- Flags, status, inventory ----

/** scr_set_flag */
export function setFlag(flag: string): boolean {
  if (flag in FLAGS && !g.game_state.flags[flag]) {
    g.game_state.flags[flag] = true;
    g.game_state.score += FLAGS[flag];
    return true;
  }
  return false;
}

/** scr_set_status */
export function setStatus(status: string): boolean {
  if (g.game_state.dead) return false;
  if (g.game_state.status === status) return false;
  g.game_state.status = status;
  g.game.with(Player, (p) => {
    if (status === STATUS_DEAD) {
      p.sprite = getSprite('spr_hugo_dead');
      p.imageIndex = 0;
    } else if (status === STATUS_HEADLESS) {
      p.sprite = getSprite('spr_hugo_headless');
      p.imageIndex = 0;
    } else {
      let name = String(spriteName(p.sprite));
      const frame = p.imageIndex;
      // Strip spr_hugo_ and any status prefix to get the facing direction.
      if (name.startsWith('spr_hugo_')) name = name.slice('spr_hugo_'.length);
      const split = name.split('_').filter((s) => s !== '');
      const dir = split.length > 1 ? split.slice(1).join('_') : split[0];
      p.sprite = getSprite('spr_hugo_' + g.game_state.status + dir);
      p.imageIndex = frame;
    }
  });
  return true;
}

/** scr_die */
export function die(removeHead = false): void {
  setStatus(removeHead ? STATUS_HEADLESS : STATUS_DEAD);
  g.game_state.dead = true;
}

export function inventoryAdd(item: string): void {
  if (!(item in g.game_state.inventory)) g.game_state.inventory[item] = item;
}

export function inventoryHas(item: string): boolean {
  return item in g.game_state.inventory;
}

export function inventoryRemove(item: string): void {
  delete g.game_state.inventory[item];
}

// ---- Room state ----

/** scr_save_room_state */
export function saveRoomState(room: string): void {
  const state: Record<string, RoomObjectState> = {};
  g.game.with(StateBase, (inst) => {
    const s: RoomObjectState = {
      _x: inst.x,
      _y: inst.y,
      _sprite: spriteName(inst.sprite),
      _frame: inst.imageIndex,
      _speed: inst.imageSpeed,
    };
    // attrs is stored by reference, exactly like the GML struct, so closures
    // bound to an instance that has since been re-created still update it.
    if (inst instanceof InteractBase) s._attrs = inst.attrs;
    state[inst.objName] = s;
  });
  g.game_state.rooms[room] = state;
}

/** scr_load_room_state */
export function loadRoomState(room: string): void {
  const game = g.game;
  const roomState = g.game_state.rooms[room];
  if (!roomState) return;
  const names = Object.keys(roomState);
  for (const name of names) {
    const tmp = roomState[name];
    const ctor = game.objectByName(name);
    if (!ctor) continue;
    if (game.exists(ctor)) {
      game.with(ctor, (inst) => {
        if (ctor === (Player as any)) {
          inst.x = g.game_state.current_x;
          inst.y = g.game_state.current_y;
          inst.sprite = getSprite(g.game_state.current_direction);
          inst.imageIndex = g.game_state.current_frame;
        } else {
          inst.x = tmp._x;
          inst.y = tmp._y;
          inst.sprite = getSprite(tmp._sprite);
          inst.imageSpeed = tmp._speed;
          if (tmp._frame !== NO_ROOM) inst.imageIndex = tmp._frame;
          if (tmp._attrs !== undefined) (inst as InteractBase).attrs = tmp._attrs;
        }
      });
    } else {
      const inst = game.instanceCreate(ctor, tmp._x, tmp._y, 100 /* "Interact" layer */);
      inst.sprite = getSprite(tmp._sprite);
      if (tmp._frame !== NO_ROOM) inst.imageIndex = tmp._frame;
      if (tmp._attrs !== undefined) (inst as InteractBase).attrs = tmp._attrs;
    }
  }
  game.with(StateBase, (inst) => {
    if (!names.includes(inst.objName)) game.destroy(inst);
  });
}

/** scr_room_transition */
export function roomTransition(room: string, x: number, y: number, direction: string | number = NO_ROOM, msg = ''): void {
  g.game_state.current_room = room;
  g.game.with(Player, (p) => {
    if (direction === NO_ROOM) g.game_state.current_direction = spriteName(p.sprite);
    else g.game_state.current_direction = 'spr_hugo_' + g.game_state.status + direction;
    g.game_state.current_frame = p.imageIndex;
  });
  g.game_state.current_x = x;
  g.game_state.current_y = y;
  g.game_state.room_enter_text = msg;
  g.transition = true;
  g.game.roomGoto(room);
}

// ---- Save games ----

const saveKey = (slot: number) => 'SAVE' + slot + '.SAV';

export function saveExists(slot: number): boolean {
  return platform.load(saveKey(slot)) !== null;
}

/** scr_read_save_file */
export function readSaveFile(slot: number): GameState | null {
  const raw = platform.load(saveKey(slot));
  if (raw === null) return null;
  const obj = JSON.parse(raw);
  if (!obj.flags) obj.flags = {};
  return obj;
}

/** scr_save */
export function saveGame(slot: number, savename: string): boolean {
  g.game_state.savename = savename;
  return platform.save(saveKey(slot), JSON.stringify(g.game_state));
}

/** scr_restore */
export function restoreGame(slot: number): void {
  const state = readSaveFile(slot);
  if (!state) throw new Error('missing save');
  restoreState(state);
}

export function restoreState(state: GameState): void {
  if (typeof state.current_room !== 'string' || !g.game.rooms[state.current_room]) throw new Error('bad save');
  g.game_state = state;
  delete g.game_state.savename;
  g.transition = true;
  g.game.roomGoto(state.current_room);
}

/** scr_generate_sr_msg */
export function generateSrMsg(): string {
  if (g.save_load_index < 0) g.save_load_index = 0;
  if (g.save_load_index >= SAVE_SLOTS) g.save_load_index = SAVE_SLOTS - 1;
  let msg = '';
  if (g.msg_state === MSG_SAVE) msg += TEXT.save;
  else if (g.msg_state === MSG_SAVE_NAME) msg += TEXT.save_name;
  else if (g.msg_state === MSG_RESTORE) {
    let exists = false;
    for (let i = 0; i < SAVE_SLOTS; i++) if (saveExists(i)) exists = true;
    if (exists) msg += TEXT.restore;
    else {
      g.msg_state = MSG_MESSAGE;
      return msg + TEXT.restore_no_saves;
    }
  } else return msg + TEXT.sr_error;

  for (let i = 0; i < SAVE_SLOTS; i++) {
    let line = i === g.save_load_index ? '> ' : '  ';
    if (g.msg_state === MSG_SAVE_NAME && i === g.save_load_index) {
      let name = g.save_name_buffer;
      if (name.length > SAVE_LENGTH) name = name.slice(0, SAVE_LENGTH);
      if (name.length < SAVE_LENGTH) name += '_';
      line += name;
    } else if (saveExists(i)) {
      let name: string | undefined;
      try {
        name = readSaveFile(i)?.savename;
      } catch {
        name = undefined;
      }
      if (name !== undefined) line += name.length > SAVE_LENGTH ? name.slice(0, SAVE_LENGTH) : name;
      else line += 'SAVE' + i;
    } else line += '.'.repeat(SAVE_LENGTH);
    if (i !== SAVE_SLOTS - 1) line += '\n';
    msg += line;
  }
  return msg;
}

// ---- Options ----

function optionValueString(v: boolean | string): string {
  if (typeof v === 'string') return v;
  return v ? 'On' : 'Off';
}

/** scr_generate_options_msg */
export function generateOptionsMsg(): string {
  const dummyPad = ' '.repeat(MIN_OPTION_PADDING);
  let longest = '';
  for (const key of OPTIONS_ORDER) {
    const opt = g.options[key];
    for (const v of opt.options) {
      const s = opt.label + optionValueString(v) + dummyPad;
      if (s.length > longest.length) longest = s;
    }
  }
  const maxLength = longest.length;
  let msg = '';
  OPTIONS_ORDER.forEach((key, o) => {
    const opt = g.options[key];
    const val = optionValueString(opt.options[opt.value]);
    const length = (opt.label + val).length;
    msg += (g.options_index === o ? '>' : ' ') + opt.label;
    msg += OPTION_PADDING_CHAR.repeat(Math.max(0, maxLength - length));
    msg += val + '\n';
  });
  msg += '\n';
  const head = 'Enter - Save ';
  const end = 'Esc - Cancel';
  msg += head + OPTION_PADDING_CHAR.repeat(Math.max(0, maxLength - (head + end).length)) + end;
  return msg;
}

/** scr_save_options */
export function saveOptions(): void {
  const values: Record<string, number> = {};
  for (const key of OPTIONS_ORDER) values[key] = g.options[key].value;
  platform.save('settings.ini', JSON.stringify(values));
  applyFullscreen();
}

/** scr_load_options */
export function loadOptions(): void {
  g.options = defaultOptions();
  try {
    const raw = platform.load('settings.ini');
    if (raw) {
      const values = JSON.parse(raw);
      for (const key of OPTIONS_ORDER) {
        const v = values[key];
        if (typeof v === 'number' && v >= 0 && v < g.options[key].options.length) g.options[key].value = v;
      }
    }
  } catch {
    /* keep defaults */
  }
  applyFullscreen();
}

function applyFullscreen(): void {
  const fs = g.options.fullscreen;
  platform.setFullscreen(fs.options[fs.value] as boolean);
}

export function cloneOptions(): typeof g.options {
  return JSON.parse(JSON.stringify(g.options));
}

export { STATUS_NORMAL };
