// Port of scripts/scr_process_command: the text parser.
import { pointDistance } from '../engine/runtime';
import { g, ROOM_ALIASES, ROOM_DESCRIPTIONS, STATUS_BUTLER, STATUS_DIZZY, STATUS_MASK, STATUS_MINI, STATUS_MUMMY, STATUS_NORMAL, STATUS_STATIC, TEXT } from './state';
import { ITEMS, ItemVerb } from './items';
import { die, inventoryAdd, setStatus, showInventory, showMessage, showRestoreMessage, showSaveMessage } from './scripts';
import { InteractBase, Player } from './objects/core';
import { platform } from './platform';

const CUSS_WORDS = ['fuck', 'shit', 'damn', 'cunt', 'bitch', 'whore', 'dammit', 'goddammit', 'damnit', 'goddamnit'];

const words = (s: string) => s.toLowerCase().split(' ').filter((w) => w !== '');

/** Finds the inventory key whose display name matches `query`. */
function findInventoryItem(query: string): string | false {
  for (const key of Object.keys(g.game_state.inventory)) {
    if (ITEMS[key] && query === ITEMS[key].inventory) return key;
  }
  return false;
}

export function processCommand(cmd: string, player: Player | null, room: string): void {
  const game = g.game;
  // If the player is answering a question, process the answer function
  if (g.question_response) {
    const fn = g.question_response;
    g.question_response = null;
    fn(cmd.toLowerCase().trim());
    g.cmd_string = '';
    return;
  }

  g.last_cmd = cmd;
  let breakdown = words(cmd);
  const action = breakdown[0];

  // Split interactable objects into nearby and far away
  const nearby: InteractBase[] = [];
  const faraway: InteractBase[] = [];
  game.with(InteractBase, (o) => {
    if (!player || pointDistance(o.x, o.y, player.x, player.y) <= o.interact_distance) nearby.push(o);
    else faraway.push(o);
  });

  const dead = () => g.game_state.dead;
  let interact = false;

  switch (action) {
    case 'debug':
      debugCommand(cmd, breakdown, room);
      break;
    case 'inventory':
    case 'pockets':
    case 'bag':
    case 'items':
      showInventory(room);
      break;
    case 'save':
      showSaveMessage(room);
      break;
    case 'load':
    case 'restore':
      showRestoreMessage(room);
      break;
    case 'fullscreen': {
      const fs = g.options.fullscreen;
      fs.value = fs.value === 0 ? 1 : 0;
      platform.setFullscreen(fs.options[fs.value] as boolean);
      showMessage(TEXT.confirm, room);
      break;
    }
    case 'look': {
      if (dead()) {
        showMessage(TEXT.dead, room);
        break;
      }
      // Look at a specific nearby object, if one was named
      for (let i = 1; i < breakdown.length && !interact; i++) {
        for (const o of nearby) {
          if (breakdown[i] === o.obj_name) {
            const look = o.triggers.get('look');
            if (look) look();
            else showMessage(o.description, room);
            interact = true;
            break;
          }
        }
        if (!interact) {
          for (const o of faraway) {
            if (breakdown[i] === o.obj_name) {
              showMessage(TEXT.too_far, room);
              interact = true;
              break;
            }
          }
        }
      }
      if (interact) break;
      // Otherwise describe the room and what can be seen
      let output = ROOM_DESCRIPTIONS[room] ?? TEXT.room_description_missing;
      const near = nearby.filter((o) => o.visible_nearby).map((o) => '\n- ' + o.list_name).join('');
      if (near !== '') output += TEXT.visible_nearby_header + near;
      const far = faraway.filter((o) => o.visible_faraway).map((o) => '\n- ' + o.list_name).join('');
      if (far !== '') output += TEXT.visible_faraway_header + far;
      showMessage(output, room);
      break;
    }
    case 'inspect': {
      if (dead()) {
        showMessage(TEXT.dead, room);
        break;
      }
      const query = breakdown.slice(1).join(' ').trim();
      if (query === '') showMessage(TEXT.default_error, room);
      else {
        const key = findInventoryItem(query);
        if (key) showMessage(ITEMS[key].inspect, room);
        else showMessage(TEXT.no_item, room);
      }
      break;
    }
    case 'use': {
      if (dead()) {
        showMessage(TEXT.dead, room);
        break;
      }
      if (breakdown.length <= 1) {
        showMessage(TEXT.default_error, room);
        break;
      }
      const query = breakdown.slice(1).join(' ').trim();
      const idx = query.toLowerCase().indexOf(' on ');
      const split = idx === -1 ? [query] : [query.slice(0, idx), query.slice(idx + 4)].filter((s) => s !== '');
      const itemId = findInventoryItem(split[0]);
      if (!itemId) {
        showMessage(TEXT.no_item, room);
        break;
      }
      if (split.length > 1) {
        // Use the item on a nearby object
        breakdown = words(split[1]);
        for (let i = 0; i < breakdown.length && !interact; i++) {
          for (const o of nearby) {
            if (o.obj_name === breakdown[i]) {
              const interaction = o.interactions.get(itemId);
              if (interaction) {
                interaction();
                interact = true;
                break;
              }
            }
          }
          if (!interact) {
            for (const o of faraway) {
              if (breakdown[i] === o.obj_name) {
                showMessage(TEXT.too_far, room);
                interact = true;
                break;
              }
            }
          }
        }
        if (!interact) showMessage(TEXT.no_use, room);
      } else {
        const use = ITEMS[itemId].use as ItemVerb | undefined;
        if (use) use(itemId, room);
        else showMessage(TEXT.no_use, room);
      }
      break;
    }
    case 'exit':
    case 'quit':
      // Only a bare "quit"/"exit" asks to quit; otherwise treat it as a verb
      if (breakdown.length === 1) {
        showMessage(TEXT.quit, room);
        break;
      }
    // falls through
    default: {
      if (CUSS_WORDS.includes(action)) {
        showMessage(TEXT.cuss, room);
        break;
      }
      if (dead()) {
        showMessage(TEXT.dead, room);
        break;
      }
      // An item-specific verb, e.g. "open pumpkin" or "blow whistle"
      const query = breakdown.slice(1).join(' ').trim();
      const itemId = findInventoryItem(query);
      if (itemId) {
        const verb = ITEMS[itemId][breakdown[0]];
        if (typeof verb === 'function') {
          verb(itemId, room);
          interact = true;
        }
      }
      if (!interact) {
        // Otherwise look for an object with a trigger for this verb
        for (let i = 1; i < breakdown.length && !interact; i++) {
          for (const o of nearby) {
            if (o.obj_name === breakdown[i]) {
              const trigger = o.triggers.get(breakdown[0]);
              if (trigger) {
                trigger(breakdown);
                interact = true;
                break;
              }
            }
          }
          if (!interact) {
            for (const o of faraway) {
              if (breakdown[i] === o.obj_name && o.triggers.get(breakdown[0])) {
                showMessage(TEXT.too_far, room);
                interact = true;
                break;
              }
            }
          }
        }
      }
      if (!interact) showMessage(TEXT.bad_command.replace(/%s/g, cmd), room);
    }
  }

  // Blank out the command so the player can enter a new one
  g.cmd_string = '';
}

function debugCommand(cmd: string, breakdown: string[], room: string): void {
  const game = g.game;
  if (cmd === 'debug me bby') {
    g.DEBUG = !g.DEBUG;
    showMessage('Debug mode is now ' + (g.DEBUG ? 'ON' : 'OFF'), room);
    return;
  }
  if (!g.DEBUG) {
    showMessage(TEXT.default_error, room);
    return;
  }
  switch (breakdown[1]) {
    case 'barriers':
      g.SHOW_BARRIERS = !g.SHOW_BARRIERS;
      showMessage('Barrier debug mode is now ' + (g.SHOW_BARRIERS ? 'ON' : 'OFF'), room);
      break;
    case 'goto': {
      const target = ROOM_ALIASES[breakdown[2]];
      if (target) game.roomGoto(target);
      else showMessage(TEXT.default_error, room);
      break;
    }
    case 'coords': {
      const p = game.first(Player);
      showMessage('X: ' + (p ? p.x : 0) + ', Y: ' + (p ? p.y : 0), room);
      break;
    }
    case 'giveitem':
      if (breakdown[2] && ITEMS[breakdown[2]]) {
        inventoryAdd(breakdown[2]);
        showMessage(TEXT.confirm, room);
      } else showMessage(TEXT.default_error, room);
      break;
    case 'status': {
      const map: Record<string, string> = {
        static: STATUS_STATIC,
        mask: STATUS_MASK,
        dizzy: STATUS_DIZZY,
        mini: STATUS_MINI,
        butler: STATUS_BUTLER,
        mummy: STATUS_MUMMY,
        normal: STATUS_NORMAL,
      };
      if (breakdown[2] in map) setStatus(map[breakdown[2]]);
      else {
        setStatus(STATUS_NORMAL);
        showMessage(TEXT.default_error, room);
      }
      break;
    }
    case 'die':
      die();
      showMessage('RIP', room);
      break;
    default:
      showMessage(TEXT.default_error, room);
  }
}
