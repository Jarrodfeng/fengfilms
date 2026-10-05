// Object classes are looked up by name to keep this module free of
// import cycles with the object modules.
// Port of global.items from _instantiate_globals: inventory names,
// inspect text and the item-specific verbs.
import { g, STATUS_MASK, STATUS_NORMAL, TEXT } from './state';
import { inventoryRemove, setFlag, setStatus, showMessage } from './scripts';
import { Player } from './objects/core';

export type ItemVerb = (itemId: string, room: string) => void;

export interface Item {
  inventory: string;
  inspect: string;
  [verb: string]: string | ItemVerb;
}

function openPumpkin(_id: string, _room: string): void {
  const game = g.game;
  game.with(Player, (p) => {
    if (game.instanceCreate(game.objectByName('obj_hhh_key')!, p.x, p.y, p.depth)) {
      inventoryRemove('pumpkin');
      setFlag('pumpkin_open');
      showMessage('The pumpkin breaks open to reveal a key!', game.room);
    }
  });
}

function useWhistle(_id: string, room: string): void {
  const game = g.game;
  let msg = 'You blow the whistle but nothing happens.';
  switch (room) {
    case 'rm_batcave':
      // Scramble the bats if blown in the batcave
      setFlag('whistle_blow');
      game.with(game.objectByName('obj_bat_base')! as any, (b: any) => {
        b.attrs.state = b.STATE_WHISTLE;
        b.attrs.move_state = b.STATE_MOVE_FREE;
      });
      showMessage(
        'The high frequency of the whistle seems to have messed up the natural sonar of the bats!&&They seem disoriented and sluggish - a perfect chance to slip past them.',
        room,
      );
      break;
    case 'rm_hall':
    case 'rm_kitchen':
      // Summon the dog if blown in certain rooms
      msg += "&&Maybe it's one of those whistles only dogs can hear?";
      if (room === 'rm_hall') game.instanceCreate(game.objectByName('obj_dog')!, 270, 165, 0);
      else game.instanceCreate(game.objectByName('obj_dog')!, 59, 143, 0);
      showMessage(msg, room);
      break;
    default:
      showMessage(msg, room);
  }
}

export const ITEMS: Record<string, Item> = {
  pumpkin: {
    inventory: 'pumpkin',
    inspect: 'A carved pumpkin. Something appears to be inside of it.',
    open: openPumpkin,
    smash: openPumpkin,
    break: openPumpkin,
  },
  housekey: {
    inventory: 'key',
    inspect: 'Looks like it could be used to unlock the front door.',
  },
  candle: {
    inventory: 'candle',
    inspect: 'A fancy looking candle. It burns brightly.',
  },
  knife: {
    inventory: 'knife',
    inspect: "It's a small folding pocket knife.",
  },
  whistle: {
    inventory: 'whistle',
    inspect: "A small silver whistle. I wonder what it's for?",
    use: useWhistle,
    blow: useWhistle,
  },
  mask: {
    inventory: 'mask',
    inspect: 'A rubber gorilla mask. Trick or treat!',
    use: (_id, room) => {
      if (g.game_state.status === STATUS_MASK) setStatus(STATUS_NORMAL);
      else if (g.game_state.status === STATUS_NORMAL) setStatus(STATUS_MASK);
      showMessage(TEXT.confirm, room);
    },
    wear: (_id, room) => {
      if (g.game_state.status === STATUS_NORMAL) {
        setStatus(STATUS_MASK);
        showMessage(TEXT.confirm, room);
      } else if (g.game_state.status === STATUS_MASK) showMessage('You are already wearing it.', room);
    },
    remove: (_id, room) => {
      if (g.game_state.status === STATUS_MASK) {
        setStatus(STATUS_NORMAL);
        showMessage(TEXT.confirm, room);
      } else if (g.game_state.status === STATUS_NORMAL) showMessage("You aren't wearing it.", room);
    },
  },
  bung: {
    inventory: 'bung',
    inspect: "A rubber bung. Since it's waterproof, it's useful for plugging holes.",
  },
  oil: {
    inventory: 'oil',
    inspect: "It's a small can of oil. It feels about half full.",
  },
  chop: {
    inventory: 'chop',
    inspect: 'A porkchop... you hope. It seems a bit on the raw side.',
    throw: (_id, room) => {
      if (room === 'rm_storerm') {
        let depth = 0;
        g.game.with(Player, (p) => (depth = p.depth));
        g.game.instanceCreate(g.game.objectByName('obj_chop')!, 85, 145, depth);
        inventoryRemove('chop');
      } else showMessage("What are you, ten? Don't play with your food.", room);
    },
    eat: (_id, room) => {
      showMessage("You can't bring yourself to do such a thing.", room);
    },
  },
  gold: {
    inventory: 'gold',
    inspect: "It's a bag of gold. Feels pretty heavy!",
  },
};
