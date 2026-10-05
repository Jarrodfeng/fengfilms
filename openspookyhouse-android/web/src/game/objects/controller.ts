// obj_room_controller (persistent HUD, hotkeys, room state, ending) and
// obj_message (the modal message / menu screen).
import { Instance } from '../../engine/runtime';
import { C, Cmd, DrawList, HAlign, SCREEN_H, SCREEN_W, VAlign } from '../../render/drawlist';
import { FONT_SIZE, stringHeightExt, stringWidthExt, wrapText } from '../../render/font';
import { getSprite } from '../sprites';
import {
  g,
  INPUT_BOX_HEIGHT,
  MAX_SCORE,
  MSG_BOX_BORDER,
  MSG_BOX_PADDING,
  MSG_MAX_WIDTH,
  MSG_MESSAGE,
  MSG_OPTIONS,
  MSG_QUESTION,
  MSG_RESTORE,
  MSG_SAVE,
  MSG_SAVE_NAME,
  MSG_SAVE_PROCESS,
  NO_ROOM,
  OPTIONS_ORDER,
  SAVE_LENGTH,
  TEXT,
} from '../state';
import {
  canInput,
  cloneOptions,
  generateOptionsMsg,
  generateSrMsg,
  loadRoomState,
  readSaveFile,
  restoreGame,
  saveExists,
  saveGame,
  saveOptions,
  saveRoomState,
  showInventory,
  showMessage,
  showRestoreMessage,
  showSaveMessage,
} from '../scripts';
import { processCommand } from '../commands';
import { Player, VK } from './core';

/** Text baseline used for the two HUD bars. */
const BAR_TEXT_Y = (INPUT_BOX_HEIGHT - FONT_SIZE) / 2;

function rect(list: DrawList, x1: number, y1: number, x2: number, y2: number, rgb: number): void {
  // draw_rectangle(x1, y1, x2, y2, false) fills inclusive coordinates
  const l = Math.round(Math.min(x1, x2));
  const t = Math.round(Math.min(y1, y2));
  const r = Math.round(Math.max(x1, x2));
  const b = Math.round(Math.max(y1, y2));
  list.push([Cmd.Rect, l, t, r - l + 1, b - t + 1, rgb]);
}

function text(list: DrawList, x: number, y: number, s: string, rgb: number, h = HAlign.Left, v = VAlign.Top, sep = 9, scale = 1): void {
  list.push([Cmd.Text, Math.round(x), Math.round(y), s, rgb, h, v, sep, scale]);
}

function scoreText(): string {
  return 'Score: ' + ' '.repeat(String(MAX_SCORE - g.game_state.score).length) + g.game_state.score + ' of ' + MAX_SCORE;
}

/** The top status bar and bottom command line shared by rooms and messages. */
function drawBars(list: DrawList): void {
  rect(list, 0, 0, SCREEN_W, INPUT_BOX_HEIGHT, C.black);
  rect(list, 0, SCREEN_H - INPUT_BOX_HEIGHT, SCREEN_W, SCREEN_H, C.black);
  text(list, 0, BAR_TEXT_Y, 'F1-Help', C.cyan);
  text(list, SCREEN_W, BAR_TEXT_Y, scoreText(), C.cyan, HAlign.Right);
  const prompt = g.DEBUG ? '#' : '>';
  text(list, 0, SCREEN_H - (INPUT_BOX_HEIGHT - BAR_TEXT_Y) - 1, prompt + g.cmd_string, C.yellow);
}

export class RoomController extends Instance {
  static objName = 'obj_room_controller';
  override persistent = true;
  jail_pos = 0;
  theend_pos = 0;
  end_sequence_pause = 60 * 2;

  override roomStart(): void {
    const room = this.game.room;
    if (room !== 'rm_message' && room !== 'rm_load') {
      if (g.game_state.rooms[room] === undefined) saveRoomState(room);
      else loadRoomState(room);
    }

    // When arriving through a transition, place the player where they belong
    if (g.transition && room !== 'rm_message') {
      this.game.with(Player, (p) => {
        p.move_x = 0;
        p.move_y = 0;
        p.imageSpeed = 0;
        p.x = g.game_state.current_x;
        p.y = g.game_state.current_y;
        p.sprite = getSprite(g.game_state.current_direction);
        if (g.game_state.current_frame !== NO_ROOM) p.imageIndex = g.game_state.current_frame;
      });
      g.msg_screenshot = [];
      g.game_state.current_frame = NO_ROOM;
      g.transition = false;
      if (g.game_state.room_enter_text !== '') {
        showMessage(g.game_state.room_enter_text, room);
        g.game_state.room_enter_text = '';
      }
    }

    // The end sequence
    if (room === 'rm_jail') {
      this.jail_pos++;
      this.alarm[0] = this.jail_pos === 1 ? this.end_sequence_pause : 10;
    }
    if (room === 'rm_theend') {
      this.theend_pos++;
      this.alarm[0] = this.theend_pos === 1 ? this.end_sequence_pause : 10;
    }
  }

  override alarmEvent(n: number): void {
    if (n !== 0) return;
    const room = this.game.room;
    if (room === 'rm_jail') {
      if (this.jail_pos === 1)
        showMessage(
          'Congratulations!&&Upon seeing Penelope, you do a little happy dance! Finally, your quest is over. You free Penelope, open the jail door, sneak past the dog, and run out of that accursed house for dear life.',
          room,
        );
      else if (this.jail_pos > 1) this.game.roomGoto('rm_theend');
    } else if (room === 'rm_theend') {
      if (this.theend_pos === 1) showMessage('Thank you for playing.&&Goodbye!', room);
      else if (this.theend_pos > 1) this.game.gameEnd();
    }
  }

  override beginStep(): void {
    // Handle returning from the save dialog
    if (g.msg_state === MSG_SAVE_PROCESS) {
      g.msg_state = MSG_MESSAGE;
      if (!saveGame(g.save_load_index, g.save_name_buffer.trim())) showMessage(TEXT.save_failed, this.game.room);
    }
  }

  /** Typing is only accepted in rooms where Hugo can act. */
  get acceptsTyping(): boolean {
    const r = this.game.room;
    return r !== 'rm_message' && r !== 'rm_load' && r !== 'rm_theend';
  }

  override keyPress(key: number): void {
    const room = this.game.room;
    switch (key) {
      case VK.enter:
        if (this.acceptsTyping && g.cmd_string.trim() !== '') processCommand(g.cmd_string.trim(), this.game.first(Player), room);
        break;
      case VK.f1:
        if (canInput()) showMessage(TEXT.help, room);
        break;
      case VK.f2:
        if (canInput()) {
          // Back up the current options in case the player cancels
          g.options_bak = cloneOptions();
          g.options_index = 0;
          showMessage(generateOptionsMsg(), room, MSG_OPTIONS);
        }
        break;
      case VK.f3:
        if (canInput() && g.last_cmd.trim() !== '') g.cmd_string = g.last_cmd;
        break;
      case VK.f4:
        if (canInput()) showSaveMessage(room);
        break;
      case VK.f5:
        if (canInput()) showRestoreMessage(room);
        break;
      case VK.f6:
        if (canInput()) showInventory(room);
        break;
      case VK.f11: {
        const fs = g.options.fullscreen;
        fs.value = fs.value === 0 ? 1 : 0;
        saveOptions();
        break;
      }
      case VK.escape:
        if (canInput()) showMessage(TEXT.quit, room);
        break;
    }
  }

  override drawGui(list: DrawList): void {
    if (canInput()) drawBars(list);
  }
}

export class Message extends Instance {
  static objName = 'obj_message';
  message_index = 0;
  messages: string[] = [''];

  private setMessages(): void {
    this.message_index = 0;
    this.messages = g.msg_string.split('&&').filter((m) => m !== '');
    if (this.messages.length === 0) this.messages = [''];
  }

  override create(): void {
    this.x = 0;
    this.y = 0;
    if (g.msg_state === MSG_SAVE || g.msg_state === MSG_SAVE_NAME || g.msg_state === MSG_RESTORE) g.msg_string = generateSrMsg();
    this.setMessages();
  }

  /** Returns to the room the message was opened from. */
  private back(): void {
    this.game.roomGoto(String(g.game_state.current_room));
  }

  /** Updates the save name while the player types it (MSG_SAVE_NAME). */
  setSaveName(name: string): void {
    if (g.msg_state !== MSG_SAVE_NAME) return;
    g.save_name_buffer = name.replace(/[^A-Za-z0-9 ]/g, '').slice(0, SAVE_LENGTH);
    g.msg_string = generateSrMsg();
    this.setMessages();
  }

  override keyPress(key: number): void {
    switch (key) {
      case VK.f1:
        // Pressing F1 on the help screen shows the instructions
        if (g.msg_string === TEXT.help) {
          g.msg_state = MSG_MESSAGE;
          g.msg_string = TEXT.instructions;
          this.setMessages();
        }
        break;
      case VK.enter:
        this.enter();
        break;
      case VK.escape:
        // Revert our options backup
        if (g.msg_state === MSG_OPTIONS) g.options = g.options_bak;
        g.msg_state = MSG_MESSAGE;
        this.back();
        break;
      case VK.left:
      case VK.right:
        if (g.msg_state === MSG_OPTIONS) {
          const opt = g.options[OPTIONS_ORDER[g.options_index]];
          const n = opt.options.length;
          opt.value = (opt.value + (key === VK.right ? 1 : n - 1)) % n;
          g.msg_string = generateOptionsMsg();
          this.setMessages();
        }
        break;
      case VK.up:
      case VK.down: {
        const d = key === VK.up ? -1 : 1;
        if (g.msg_state === MSG_SAVE || g.msg_state === MSG_RESTORE) {
          g.save_load_index += d;
          g.msg_string = generateSrMsg();
          this.setMessages();
        } else if (g.msg_state === MSG_OPTIONS) {
          const n = OPTIONS_ORDER.length;
          g.options_index = (g.options_index + d + n) % n;
          g.msg_string = generateOptionsMsg();
          this.setMessages();
        }
        break;
      }
      case VK.n:
        if (g.msg_string === TEXT.quit) this.back();
        break;
      case VK.y:
        if (g.msg_string === TEXT.quit) this.game.gameEnd();
        break;
    }
  }

  private enter(): void {
    switch (g.msg_state) {
      case MSG_SAVE:
        if (saveExists(g.save_load_index)) {
          let name = '';
          try {
            name = readSaveFile(g.save_load_index)?.savename ?? '';
          } catch {
            name = '';
          }
          g.save_name_buffer = name.slice(0, SAVE_LENGTH);
        } else g.save_name_buffer = '';
        g.msg_state = MSG_SAVE_NAME;
        g.msg_string = generateSrMsg();
        this.setMessages();
        break;
      case MSG_SAVE_NAME:
        // Go back to the previous room where the actual save is handled
        if (g.save_name_buffer.trim() !== '') {
          g.msg_state = MSG_SAVE_PROCESS;
          this.back();
        }
        break;
      case MSG_RESTORE:
        if (saveExists(g.save_load_index)) {
          try {
            restoreGame(g.save_load_index);
          } catch {
            g.msg_state = MSG_MESSAGE;
            g.msg_string = TEXT.restore_failed;
            this.setMessages();
          }
        }
        break;
      case MSG_MESSAGE:
      case MSG_QUESTION:
        if (this.message_index + 1 < this.messages.length) this.message_index++;
        else this.back();
        break;
      case MSG_OPTIONS:
        saveOptions();
        g.msg_state = MSG_MESSAGE;
        this.back();
        break;
    }
  }

  override draw(): void {}

  override drawGuiEnd(list: DrawList): void {
    // The room as it looked when the message opened
    rect(list, 0, 0, SCREEN_W, SCREEN_H, C.black);
    for (const c of g.msg_screenshot) list.push(c);
    drawBars(list);

    const msg = this.messages[this.message_index] ?? '';
    const sep = FONT_SIZE * 1.5;
    const wrapW = SCREEN_W * MSG_MAX_WIDTH;
    const w = stringWidthExt(msg, wrapW);
    const h = stringHeightExt(msg, sep, wrapW);
    const cx = SCREEN_W / 2;
    const cy = SCREEN_H / 2;
    const pad = MSG_BOX_PADDING;
    const border = MSG_BOX_BORDER;
    rect(list, cx - w / 2 - pad - border, cy - h / 2 - pad - border, cx + w / 2 + pad + border, cy + h / 2 + pad + border, C.msgBorder);
    rect(list, cx - w / 2 - pad, cy - h / 2 - pad, cx + w / 2 + pad, cy + h / 2 + pad, C.black);
    text(list, cx - w / 2, cy, wrapText(msg, wrapW).join('\n'), C.cyan, HAlign.Left, VAlign.Middle, sep);
  }
}
