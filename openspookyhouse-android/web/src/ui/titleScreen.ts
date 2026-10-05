// The loading / title screen, drawn like OpenSpookyHouse's rm_load
// (obj_load_controller's Draw GUI event).
import { C, Cmd, DrawList, HAlign, SCREEN_H, SCREEN_W } from '../render/drawlist';
import { BUILD_VER, GAME_NAME, INPUT_BOX_HEIGHT } from '../game/state';

export function titleScreen(message: string, progress = 0, subProgress = 0): DrawList {
  const list: DrawList = [];
  const lineH = 9;
  list.push([Cmd.Text, SCREEN_W / 2, lineH, GAME_NAME, C.purple, HAlign.Center, 0, lineH, 2]);
  list.push([Cmd.Text, SCREEN_W / 2, Math.round(lineH * 2 + lineH * 1.5), BUILD_VER, C.purple, HAlign.Center, 0, lineH, 1]);
  list.push([Cmd.Text, SCREEN_W / 2, SCREEN_H / 2, message, C.white, HAlign.Center, 0, lineH, 1]);
  if (progress > 0) list.push([Cmd.Rect, 0, SCREEN_H - INPUT_BOX_HEIGHT, Math.round(SCREEN_W * progress), INPUT_BOX_HEIGHT, C.purple]);
  if (subProgress > 0) list.push([Cmd.Rect, 0, SCREEN_H - INPUT_BOX_HEIGHT - 1, Math.round(SCREEN_W * subProgress), 1, C.green]);
  return list;
}
