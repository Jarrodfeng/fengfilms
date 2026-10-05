// Port of scripts/_instantiate_globals: tunables, constants, text strings,
// score flags, room descriptions and the mutable global game state.
import type { Game } from '../engine/runtime';

export const GAME_NAME = 'OpenSpookyHouse';
export const GAME_VER = 'Beta';
export const BUILD_VER = GAME_VER + ' (Android port 1.0)';

// Tunable variables
export const MSG_MAX_WIDTH = 0.9;
export const SAVE_SLOTS = 8;
export const SAVE_LENGTH = 26;
export const MIN_OPTION_PADDING = 8;
export const OPTION_PADDING_CHAR = ' ';
export const MOVESPEED = 0.75;
export const FIRST_ROOM = 'rm_house';
export const INTERACT_DISTANCE = 60;
export const DEFAULT_SPRITE_SPEED = 10;

// Static variables
export const MSG_MESSAGE = 0;
export const MSG_SAVE = 1;
export const MSG_SAVE_NAME = 2;
export const MSG_SAVE_PROCESS = 3;
export const MSG_RESTORE = 4;
export const MSG_QUESTION = 5;
export const MSG_OPTIONS = 6;
export const NO_ROOM = -1;
export const STATUS_NORMAL = '';
export const STATUS_STATIC = 'static_';
export const STATUS_MASK = 'mask_';
export const STATUS_DIZZY = 'dizzy_';
export const STATUS_MINI = 'mini_';
export const STATUS_BUTLER = 'butler_';
export const STATUS_MUMMY = 'mummy_';
export const STATUS_DEAD = 'spr_hugo_dead';
export const STATUS_HEADLESS = 'spr_hugo_headless';
export const STATUS_WON = 'spr_hugo_dizzy_right';

// UI tweaks
export const MSG_BOX_PADDING = 4;
export const MSG_BOX_BORDER = 1;
export const INPUT_BOX_HEIGHT = 10;

export interface RoomObjectState {
  _x: number;
  _y: number;
  _sprite: string | number;
  _frame: number;
  _speed: number;
  _attrs?: any;
}

export interface GameState {
  dead: boolean;
  current_room: string | number;
  room_enter_text: string;
  current_x: number;
  current_y: number;
  current_direction: string | number;
  current_frame: number;
  status: string;
  rooms: Record<string, Record<string, RoomObjectState>>;
  inventory: Record<string, string>;
  flags: Record<string, boolean>;
  score: number;
  savename?: string;
}

export function newGameState(): GameState {
  return {
    dead: false,
    current_room: NO_ROOM,
    room_enter_text: '',
    current_x: 0,
    current_y: 0,
    current_direction: NO_ROOM,
    current_frame: 0,
    status: STATUS_NORMAL,
    rooms: {},
    inventory: {},
    flags: {},
    score: 0,
  };
}

export interface OptionDef {
  label: string;
  options: (boolean | string)[];
  default: number;
  value: number;
}

export function defaultOptions(): Record<string, OptionDef> {
  return {
    sound: { label: 'Sounds', options: [false, true], default: 1, value: 1 },
    music: { label: 'Music', options: [false, true], default: 1, value: 1 },
    audio_source: { label: 'Audio', options: ['PC Speaker', 'MIDI'], default: 0, value: 0 },
    fullscreen: { label: 'Fullscreen', options: [true, false], default: 1, value: 1 },
  };
}

export const OPTIONS_ORDER = ['sound', 'music', 'audio_source', 'fullscreen'];

/** Mutable globals (the GML `global.` namespace). */
export const g = {
  game: null as unknown as Game,
  DEBUG: false,
  SHOW_BARRIERS: false,
  cmd_string: '',
  last_cmd: '',
  msg_string: '',
  question_response: null as null | ((answer: string) => void),
  save_name_buffer: '',
  transition: false,
  msg_screenshot: [] as any[],
  msg_state: MSG_MESSAGE,
  save_load_index: 0,
  options_index: 0,
  game_state: newGameState(),
  options: defaultOptions(),
  options_bak: defaultOptions(),
};

// Other text strings
export const TEXT = {
  help:
    'ESC - Quit game\n' +
    'F1  - Press F1 again\n' +
    '      for instructions\n' +
    'F2  - Options\n' +
    'F3  - Recall last line\n' +
    'F4  - Save game\n' +
    'F5  - Restore game\n' +
    'F6  - Inventory\n' +
    'F11 - Toggle fullscreen',
  instructions:
    'You may control Hugo with the arrow keys or keypad. You may also give him simple commands to interact with things that catch your eye.\nSome useful commands are "look" and "look at..." to check the room, "take..." to pick up an item, "inspect..." to check an item you have, and "use" and "use... on..." to use items.\nGet creative and think outside the box!',
  save: 'Select a slot to SAVE game\nby using the up/down arrow\nkeys, then hit return.\n\n',
  save_name: 'Enter a description for\n       this game:\n\n',
  restore: 'Select a game to RESTORE\nby using the up/down arrow\nkeys, then hit return.\n\n',
  restore_no_saves: 'No games to restore!',
  inventory_header: '    You are carrying:\n',
  inventory_footer: '\nPress ESCAPE to continue',
  inventory_empty: 'Your pockets are empty.',
  quit: 'Are you sure you want to QUIT?\n(y/n)',
  sr_error: 'Whoopsie. Something broke. Press Esc to close this message.',
  restore_failed: 'Failed to load save. Did the game get updated?',
  save_failed: 'Failed to save game.',
  dead: 'You are too dead to do that.',
  confirm: 'Ok.',
  cuss: 'Same to you, loser!',
  too_far: "You're not close enough.",
  no_item: "You aren't carrying that.",
  bad_command: 'I\'m not sure what you mean by "%s".',
  default_error: 'Eh?',
  no_use: 'Nothing happens.',
  visible_nearby_header: '\n\nAround you, you can see:',
  visible_faraway_header: '\n\nIn the distance, you can see:',
  room_description_missing:
    "This is a spooky room. Nobody knows what goes on here.\n(Totally not because the developer forgot to put in a description for this room!)",
};

// Game flags (for score): flag -> score value
export const FLAGS: Record<string, number> = {
  pumpkin_pickup: 2,
  pumpkin_open: 5,
  key_take: 5,
  enter_house: 11,
  candle_take: 3,
  hole_look: 8,
  knife_take: 6,
  whistle_take: 6,
  bung_take: 11,
  mask_take: 4,
  door_combo: 9,
  oil_take: 4,
  chop_take: 8,
  chop_reclaim: 8,
  carpet_move: 8,
  trapdoor_open: 17,
  batcave_enter: 12,
  whistle_blow: 7,
  gold_take: 10,
  questions_answer: 33,
  gold_give: 21,
};

export const MAX_SCORE = Object.values(FLAGS).reduce((a, b) => a + b, 0);

/** Familiar names for the debug "goto" command. */
export const ROOM_ALIASES: Record<string, string> = {
  house: 'rm_house',
  hall: 'rm_hall',
  basement: 'rm_basement',
  batcave: 'rm_batcave',
  bathroom: 'rm_bathroom',
  bedroom: 'rm_bedroom',
  deadend: 'rm_deadend',
  diningroom: 'rm_diningrm',
  garden: 'rm_garden',
  jail: 'rm_jail',
  kitchen: 'rm_kitchen',
  lab: 'rm_lab',
  lakeroom: 'rm_lakeroom',
  mummyroom: 'rm_mummyrm',
  storeroom: 'rm_storerm',
  theend: 'rm_theend',
};

export const BACKGROUNDS: Record<string, string> = {
  rm_house: 'spr_bkg_house',
  rm_hall: 'spr_bkg_hall',
  rm_basement: 'spr_bkg_basement',
  rm_batcave: 'spr_bkg_batcave',
  rm_bathroom: 'spr_bkg_bathroom',
  rm_bedroom: 'spr_bkg_bed1',
  rm_deadend: 'spr_bkg_deadend',
  rm_diningrm: 'spr_bkg_diningrm',
  rm_garden: 'spr_bkg_garden',
  rm_jail: 'spr_bkg_jail',
  rm_kitchen: 'spr_bkg_kitchen',
  rm_lab: 'spr_bkg_lab',
  rm_lakeroom: 'spr_bkg_lakeroom',
  rm_mummyrm: 'spr_bkg_mummy_room',
  rm_storerm: 'spr_bkg_storerm',
  rm_theend: 'spr_bkg_theend',
};

export const ROOM_DESCRIPTIONS: Record<string, string> = {
  rm_house: 'You are outside of a spooky looking house. Penelope must be inside!',
  rm_hall: 'You are in the grand hallway of the house. Various paintings decorate the halls.',
  rm_bathroom: 'You are in the bathroom. If you need to go, make sure you wash your hands after.',
  rm_basement: 'You are in a dark, damp basement. You can faintly hear a series of screeching sounds in the distance.',
  rm_batcave: 'You are in a cave full of vicious-looking bats.',
  rm_bedroom: "You are in the bedroom. Why does a house of this size only have one bedroom? It's better not to ask.",
  rm_deadend: 'You are at a dead end. A guard stands by a doorway.',
  rm_diningrm: 'You are in the dining room. A series of ghouls and fiendish friends are dining on various meats.',
  rm_garden: 'You are in the garden. For a brief moment, you feel less on edge as you take in the tranquility out here.',
  rm_jail: 'You are in the jail deep under the house. You have rescued your beloved Penelope!',
  rm_kitchen: "You are in the kitchen. It's surprisingly clean.",
  rm_lab:
    "You are in the mad scientist's lab. Various gizmos and doodads are strewn about on a table and a panel of buttons on the other side of the room seems to be manned by a rather ugly, unpleasant fellow.",
  rm_lakeroom: 'You are in a gigantic cave. A large underground lake separates the two sections of land here.',
  rm_mummyrm: "You are in a room with an ominous looking coffin. This isn't going to be good.",
  rm_storerm: "You are in the storeroom. It's rather empty for a storeroom.",
  rm_theend: 'You gaze lovingly into Penelope\'s eyes. "Thank you," she whispers with a loving smile on her face.',
};
