// High-level game session used by the UI: new game / continue, input,
// fixed-rate stepping and frame output.
import { Game } from '../engine/runtime';
import { DrawList } from '../render/drawlist';
import { ROOMS } from './data.generated';
import {
  BACKGROUNDS,
  FIRST_ROOM,
  g,
  GameState,
  MSG_MESSAGE,
  MSG_OPTIONS,
  MSG_QUESTION,
  MSG_RESTORE,
  MSG_SAVE,
  MSG_SAVE_NAME,
  newGameState,
  TEXT,
} from './state';
import { getBackground, spriteName } from './sprites';
import { loadOptions, restoreState, saveRoomState } from './scripts';
import { MASKS, TRANSITIONS, Barrier, CubicleBounds, HallMask, Player, PlayerHitboxLarge, ShedBounds, VK } from './objects/core';
import { HOUSE_OBJECTS } from './objects/house';
import { CAVE_OBJECTS } from './objects/caves';
import { LAB_OBJECTS } from './objects/lab';
import { Message, RoomController } from './objects/controller';

export { VK };

export type UiMode = 'play' | 'message' | 'question' | 'menu-save' | 'save-name' | 'menu-restore' | 'options' | 'quit' | 'ended';

export interface UiState {
  mode: UiMode;
  room: string;
  /** What the text box edits: the command line, a save name or nothing. */
  textTarget: 'command' | 'savename' | 'none';
  text: string;
  dead: boolean;
  /** Current walking direction of Hugo (null when standing still). */
  walking: 'left' | 'right' | 'up' | 'down' | null;
  score: number;
  /** True when the message being shown has more pages. */
  morePages: boolean;
}

export class GameSession {
  readonly game: Game;
  onEnd: (() => void) | null = null;

  constructor() {
    this.game = new Game(ROOMS, {
      background: (room) => {
        const name = BACKGROUNDS[room];
        return name ? getBackground(name) : null;
      },
    });
    this.game.register(
      Player,
      PlayerHitboxLarge,
      Barrier,
      CubicleBounds,
      ShedBounds,
      HallMask,
      ...MASKS,
      ...TRANSITIONS,
      ...HOUSE_OBJECTS,
      ...CAVE_OBJECTS,
      ...LAB_OBJECTS,
      RoomController,
      Message,
    );
    this.game.onEnd = () => this.onEnd?.();
    g.game = this.game;
  }

  private reset(): void {
    const game = this.game;
    game.instances = [];
    game.ended = false;
    game.pendingRoom = null;
    game.keyQueue = [];
    game.lastWorld = [];
    g.DEBUG = false;
    g.SHOW_BARRIERS = false;
    g.cmd_string = '';
    g.last_cmd = '';
    g.msg_string = '';
    g.question_response = null;
    g.save_name_buffer = '';
    g.transition = false;
    g.msg_screenshot = [];
    g.msg_state = MSG_MESSAGE;
    g.save_load_index = 0;
    g.options_index = 0;
    g.game_state = newGameState();
    loadOptions();
    // obj_room_controller lives in rm_load and persists across rooms
    const rc = new RoomController(game);
    rc.id = game.nextId++;
    game.instances.push(rc);
    rc.create();
  }

  newGame(): void {
    this.reset();
    this.game.startIn(FIRST_ROOM);
  }

  /** Continues from an autosaved game state. */
  continueFrom(state: GameState): void {
    this.reset();
    restoreState(state);
    this.game.startIn(state.current_room as string);
  }

  /**
   * Snapshot for an autosave (taken when the app goes to the background).
   * Returns null when there is nothing worth saving.
   */
  snapshot(): GameState | null {
    const game = this.game;
    if (!game.room || game.ended || g.game_state.dead) return null;
    if (game.room === 'rm_jail' || game.room === 'rm_theend') return null;
    if (game.room !== 'rm_message') {
      game.with(Player, (p) => {
        g.game_state.current_x = p.x;
        g.game_state.current_y = p.y;
        g.game_state.current_direction = spriteName(p.sprite);
        g.game_state.current_frame = p.imageIndex;
      });
      g.game_state.current_room = game.room;
      saveRoomState(game.room);
    }
    if (typeof g.game_state.current_room !== 'string') return null;
    return JSON.parse(JSON.stringify(g.game_state));
  }

  pressKey(vk: number): void {
    this.game.keyQueue.push(vk);
  }

  /** The text box changed (command line or save name). */
  setText(value: string): void {
    const ui = this.uiState();
    if (ui.textTarget === 'savename') {
      this.game.first(Message)?.setSaveName(value);
    } else if (ui.textTarget === 'command') {
      // Only letters, digits and spaces are accepted, like the original
      g.cmd_string = value.replace(/[^A-Za-z0-9 ]/g, '');
    }
  }

  tick(): void {
    this.game.tick();
  }

  render(): DrawList {
    return this.game.render();
  }

  uiState(): UiState {
    const game = this.game;
    let mode: UiMode = 'play';
    let morePages = false;
    if (game.ended) mode = 'ended';
    else if (game.room === 'rm_message') {
      const m = game.first(Message);
      morePages = !!m && m.message_index + 1 < m.messages.length;
      if (g.msg_string === TEXT.quit) mode = 'quit';
      else if (g.msg_state === MSG_SAVE) mode = 'menu-save';
      else if (g.msg_state === MSG_SAVE_NAME) mode = 'save-name';
      else if (g.msg_state === MSG_RESTORE) mode = 'menu-restore';
      else if (g.msg_state === MSG_OPTIONS) mode = 'options';
      else if (g.msg_state === MSG_QUESTION) mode = 'question';
      else mode = 'message';
    }
    const p = game.first(Player);
    let walking: UiState['walking'] = null;
    if (p && p.moving) walking = p.move_x < 0 ? 'left' : p.move_x > 0 ? 'right' : p.move_y < 0 ? 'up' : 'down';
    const rc = game.first(RoomController);
    const typing = mode === 'play' && !!rc && rc.acceptsTyping;
    return {
      mode,
      room: game.room,
      textTarget: mode === 'save-name' ? 'savename' : typing ? 'command' : 'none',
      text: mode === 'save-name' ? g.save_name_buffer : g.cmd_string,
      dead: g.game_state.dead,
      walking,
      score: g.game_state.score,
      morePages,
    };
  }
}
