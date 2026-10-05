// Objects in the house: outside, hall, bedroom, dining room, kitchen,
// storeroom and garden.
import { Ctor, eq, irandomRange, clamp } from '../../engine/runtime';
import { getSprite } from '../sprites';
import { g, MOVESPEED, STATUS_MASK, TEXT } from '../state';
import { askQuestion, die, inventoryAdd, inventoryHas, inventoryRemove, setFlag, showMessage } from '../scripts';
import {
  Barrier,
  DiningroomMask,
  DoorAutoclose,
  InteractBase,
  InteractSolidBase,
  ItemBase,
  MaskBase,
  MvHallLab,
  Player,
  ShedBounds,
} from './core';

// ---- Outside the house ----

export class HhhPumpkin extends InteractBase {
  static objName = 'obj_hhh_pumpkin';
  item = 'pumpkin';
  override create(): void {
    this.obj_name = 'pumpkin';
    this.list_name = 'A pumpkin';
    this.description = 'Something appears to be inside of it.';
    this.sprite = getSprite('spr_pumpkin');
    this.triggers.set('take', () => {
      inventoryAdd(this.item);
      this.game.destroy(this);
      setFlag('pumpkin_pickup');
      showMessage(TEXT.confirm, this.room);
    });
    this.triggers.set('smash', () => {
      if (this.game.instanceCreate(HhhKey, this.x, this.y, this.depth)) {
        this.game.destroy(this);
        setFlag('pumpkin_open');
        showMessage('The pumpkin breaks open to reveal a key!', this.room);
      }
    });
    this.triggers.set('break', () => this.triggers.get('smash')!());
  }
}

export class HhhKey extends ItemBase {
  static objName = 'obj_hhh_key';
  override create(): void {
    this.obj_name = 'key';
    this.list_name = 'A key';
    this.description = 'Looks like a front door key to me.';
    this.item = 'housekey';
    this.visible_faraway = false;
    this.sprite = getSprite('spr_key');
    this.triggers.set('take', () => {
      inventoryAdd(this.item);
      this.game.destroy(this);
      setFlag('key_take');
      showMessage(TEXT.confirm, this.room);
    });
  }
}

export class HhhFrontdoor extends InteractSolidBase {
  static objName = 'obj_hhh_frontdoor';
  override solid = true;
  override create(): void {
    this.obj_name = 'door';
    this.list_name = 'The front door';
    this.description = 'You should try opening it.';
    this.sprite = getSprite('spr_door');
    this.imageSpeed = 0;
    this.attrs.locked = true;
    this.triggers.set('open', () => {
      if (!this.attrs.locked) this.imageSpeed = 1;
      else showMessage("It's locked.", this.room);
    });
    this.triggers.set('kick', () => {
      showMessage('Ow! This door is solid. Your kick did more damage to your foot than to the door.', this.room);
    });
    this.triggers.set('unlock', () => {
      if (inventoryHas('housekey')) this.interactions.get('housekey')!();
      else showMessage("You don't have a key.", this.room);
    });
    this.interactions.set('housekey', () => {
      inventoryRemove('housekey');
      this.attrs.locked = false;
      showMessage(TEXT.confirm, this.room);
    });
  }
  override step(): void {
    this.game.with(Player, (p) => (this.depth = p.depth + 1));
    // Destroy the door once opened
    if (eq(this.imageIndex, this.imageNumber - 1)) this.game.destroy(this);
  }
}

// ---- Hall ----

export class Hole extends InteractBase {
  static objName = 'obj_hole';
  override create(): void {
    this.obj_name = 'hole';
    this.visible_nearby = false;
    this.visible_faraway = false;
    this.list_name = 'A cubby hole';
    this.description = "It's too dark to see inside....";
    this.triggers.set('look', () => {
      let msg = this.description;
      if (inventoryHas('candle')) {
        setFlag('hole_look');
        const knife = this.game.first(Knife);
        const whistle = this.game.first(Whistle);
        if (knife || whistle) {
          msg += '\n\n...Actually, using the candlelight, buried under all the dust you can just barely make out:';
          if (knife) msg += '\n- ' + knife.list_name;
          if (whistle) msg += '\n- ' + whistle.list_name;
        }
      }
      showMessage(msg, this.room);
    });
  }
}

function takeable(inst: ItemBase, flag: string, message: string = TEXT.confirm): void {
  inst.triggers.set('take', () => {
    inventoryAdd(inst.item);
    inst.game.destroy(inst);
    setFlag(flag);
    showMessage(message, inst.room);
  });
}

export class Knife extends ItemBase {
  static objName = 'obj_knife';
  override create(): void {
    this.obj_name = 'knife';
    this.list_name = 'A pocket knife';
    this.description = "It's a small folding pocket knife.";
    this.item = 'knife';
    this.visible_faraway = false;
    this.visible_nearby = false;
    takeable(this, 'knife_take');
  }
}

export class Whistle extends ItemBase {
  static objName = 'obj_whistle';
  override create(): void {
    this.obj_name = 'whistle';
    this.list_name = 'A small silver whistle';
    this.description = "It's a small silver whistle.";
    this.item = 'whistle';
    this.visible_faraway = false;
    this.visible_nearby = false;
    takeable(this, 'whistle_take', TEXT.confirm + '&&I wonder what the whistle is for?');
  }
}

export class Candle extends ItemBase {
  static objName = 'obj_candle';
  override create(): void {
    this.obj_name = 'candle';
    this.list_name = 'A candle';
    this.description = 'A small candle that burns brightly.';
    this.item = 'candle';
    this.visible_faraway = false;
    this.sprite = getSprite('spr_candle');
    takeable(this, 'candle_take');
  }
}

/** Shared behaviour of the doors that close again when Hugo leaves the room. */
abstract class SwingDoor extends DoorAutoclose {
  abstract spriteName: string;
  depthOffset = 5;
  override create(): void {
    this.obj_name = 'door';
    this.list_name = 'A door';
    this.description = "It's an old wooden door.";
    this.visible_faraway = false;
    this.visible_nearby = false;
    this.attrs.opened = false;
    this.imageSpeed = 0;
  }
  override step(): void {
    this.game.with(Player, (p) => (this.depth = p.depth + this.depthOffset));
    if (this.sprite && eq(this.imageIndex, this.imageNumber - 1)) this.attrs.opened = true;
  }
  override endStep(): void {
    if (!this.sprite && !this.attrs.opened) {
      this.sprite = getSprite(this.spriteName);
      this.imageIndex = 0;
    } else if (this.attrs.opened) this.sprite = null;
  }
}

abstract class HallDoor extends SwingDoor {
  spriteName = 'spr_hall_door';
  override create(): void {
    super.create();
    this.triggers.set('knock', () => showMessage('Nobody answers.', this.room));
    this.triggers.set('open', () => {
      if (!this.attrs.opened) this.imageSpeed = 1;
    });
  }
}

export class HallDoorLeft extends HallDoor {
  static objName = 'obj_hall_door_left';
}

export class HallDoorRight extends HallDoor {
  static objName = 'obj_hall_door_right';
}

export class ProfessorHall extends InteractBase {
  static objName = 'obj_professor_hall';
  override create(): void {
    this.obj_name = 'professor';
    this.list_name = 'The Professor';
    this.description = 'A man in a lab coat. He gives off serious mad scientist vibes.';
    this.visible_faraway = false;
    this.visible_nearby = false;
    this.interact_distance = 1;
    this.sprite = getSprite('spr_prof_right');
    this.imageSpeed = 1;
  }
  override step(): void {
    super.step();
    // Just move to the right
    this.x += MOVESPEED;
  }
  override collisionEvents(): [Ctor, (o: any) => void][] {
    return [[MvHallLab, () => this.game.destroy(this)]];
  }
}

// ---- Bedroom ----

export class Bed extends InteractSolidBase {
  static objName = 'obj_bed';
  override create(): void {
    this.obj_name = 'bed';
    this.list_name = 'A bed';
    this.description = 'You carefully inspect the bed and find... absolutely nothing!';
    this.visible_faraway = false;
    this.visible_nearby = false;
  }
}

abstract class ClosetDoor extends SwingDoor {
  override depthOffset = 1;
  abstract otherDoor(): Ctor<ClosetDoor>;
  override create(): void {
    super.create();
    this.list_name = 'A wardrobe door';
    this.triggers.set('open', () => {
      if (!this.attrs.opened) this.imageSpeed = 1;
      // Open the other closet door too
      this.game.with(this.otherDoor(), (d) => {
        if (!d.attrs.opened) d.imageSpeed = 1;
      });
    });
  }
}

export class ClosetDoorLeft extends ClosetDoor {
  static objName = 'obj_closet_door_left';
  spriteName = 'spr_wardrobe_door_left';
  otherDoor() {
    return ClosetDoorRight;
  }
}

export class ClosetDoorRight extends ClosetDoor {
  static objName = 'obj_closet_door_right';
  spriteName = 'spr_wardrobe_door_right';
  otherDoor() {
    return ClosetDoorLeft;
  }
}

export class Mask extends InteractBase {
  static objName = 'obj_mask';
  item = 'mask';

  /** The mask can only be reached once the wardrobe is open. */
  private closetOpen(): boolean {
    if (this.game.room !== 'rm_bedroom') return true;
    let open = false;
    this.game.with(ClosetDoorLeft, (d) => {
      if (!d.sprite || d.imageIndex >= 1) open = true;
    });
    return open;
  }

  override create(): void {
    this.obj_name = 'mask';
    this.list_name = 'A mask';
    this.description = "It's a rubber gorilla mask.";
    this.visible_faraway = false;
    this.visible_nearby = false;
    this.sprite = getSprite('spr_mask');
    this.triggers.set('take', () => {
      if (this.closetOpen()) {
        inventoryAdd(this.item);
        this.game.destroy(this);
        setFlag('mask_take');
        showMessage(TEXT.confirm, this.room);
      }
    });
    this.triggers.set('look', () => {
      if (this.closetOpen()) showMessage(this.description, this.room);
    });
  }

  override step(): void {
    let open = false;
    this.game.with(ClosetDoorLeft, (d) => {
      if (!d.sprite || d.imageIndex >= 1) open = true;
    });
    if (!open) this.game.with(Player, (p) => (this.depth = p.depth + 10));
    else super.step();
  }
}

// ---- Dining room, kitchen, storeroom ----

export class Butler extends InteractBase {
  static objName = 'obj_butler';
  readonly STATE_FREE = 0;
  readonly STATE_WANDER = 1;
  readonly STATE_DIRECT = 2;
  readonly STATE_QUESTION = 3;
  move_wait_time = 60 * 2.5;
  move_speed_wander = MOVESPEED / 2;
  move_speed_direct = MOVESPEED;
  move_speed = MOVESPEED / 2;
  wander_attempts = 50;
  wander_range = 30;
  wanders = 0;

  override create(): void {
    this.obj_name = 'butler';
    this.list_name = 'Butler';
    this.description = 'An old-fashioned butler. He looks like he has an air of arrogance about him.';
    this.visible_faraway = false;
    this.visible_nearby = false;
    this.interact_distance = 10;
    this.sprite = getSprite('spr_butler_right');
    this.imageSpeed = 0;
    this.attrs.chop_given = false;
    this.attrs.move_state = this.STATE_FREE;
    this.attrs.move_destination_x = this.x;
    this.attrs.move_destination_y = this.y;
  }

  override alarmEvent(n: number): void {
    if (n !== 0 || this.attrs.move_state !== this.STATE_FREE) return;
    // If the butler has wandered around enough, he will directly go to the player
    if (this.wanders === 2 && !this.attrs.chop_given && !g.game_state.dead) this.attrs.move_state = this.STATE_DIRECT;
    else {
      let attempts = 0;
      let nx = 0;
      let ny = 0;
      do {
        nx = clamp(irandomRange(this.x - this.wander_range, this.x + this.wander_range), 0, this.game.roomWidth);
        ny = clamp(irandomRange(this.y - this.wander_range, this.y + this.wander_range), 0, this.game.roomHeight);
        attempts++;
      } while (this.game.placeMeeting(this, nx, ny, Barrier) && attempts < this.wander_attempts);
      if (attempts < this.wander_attempts) {
        this.wanders++;
        this.attrs.move_destination_x = nx;
        this.attrs.move_destination_y = ny;
        this.attrs.move_state = this.STATE_WANDER;
      }
    }
  }

  override collisionEvents(): [Ctor, (o: any) => void][] {
    return [[Player, () => this.askForChop()]];
  }

  private askForChop(): void {
    if (this.attrs.move_state !== this.STATE_DIRECT) return;
    this.attrs.move_state = this.STATE_QUESTION;
    const intruder =
      "Very good, sir. *sniff* Wait a minute....&&Hey, this one's not one of us! We've got an intruder! Come here, you.&&The butler with seemingly superhuman speed swiftly slices your head off with a carving knife. So much for rescuing Penelope!";
    askQuestion('Care for a chop, sir?', this.room, (cmd) => {
      const room = this.game.room;
      this.attrs.move_state = this.STATE_FREE;
      if (cmd.includes('yes')) {
        // If the player says yes, make sure they are wearing a mask before giving them the chop
        if (g.game_state.status === STATUS_MASK) {
          inventoryAdd('chop');
          this.attrs.chop_given = true;
          setFlag('chop_take');
          showMessage('Very good, sir. *sniff* Enjoy.', room);
        } else {
          die(true);
          showMessage(intruder, room);
        }
      } else if (g.game_state.status === STATUS_MASK) showMessage('Very good, sir. *sniff* Perhaps later.', room);
      else {
        die(true);
        showMessage(intruder, room);
      }
    });
  }

  override step(): void {
    const game = this.game;
    // Adjust depth based on table and player position
    game.with(DiningroomMask, (table) => {
      let playerSame = false;
      if (this.y < table.y + table.offset) {
        game.with(Player, (p) => (playerSame = p.y < table.y + table.offset));
        if (playerSame) {
          let d = this.depth;
          game.with(Player, (p) => {
            if (p.y < table.y) d = p.depth - 5;
            else if (p.y > table.y) d = p.depth + 5;
          });
          this.depth = d;
        } else this.depth = table.depth + 10;
      } else if (this.y > table.y + table.offset) {
        game.with(Player, (p) => (playerSame = p.y > table.y + table.offset));
        if (playerSame) {
          let d = this.depth;
          game.with(Player, (p) => {
            if (p.y < table.y) d = p.depth - 5;
            else if (p.y > table.y) d = p.depth + 5;
          });
          this.depth = d;
        } else this.depth = table.depth - 10;
      }
    });

    switch (this.attrs.move_state) {
      case this.STATE_FREE:
        if (this.alarm[0] === -1) this.alarm[0] = this.move_wait_time;
        this.imageSpeed = 0;
        break;
      case this.STATE_WANDER:
        this.move_speed = this.move_speed_wander;
        break;
      case this.STATE_DIRECT:
        this.move_speed = this.move_speed_direct;
        break;
      case this.STATE_QUESTION:
        this.imageSpeed = 0;
        break;
    }

    if (this.attrs.move_state === this.STATE_FREE || this.attrs.move_state === this.STATE_QUESTION) return;
    this.imageSpeed = 1;
    let dx = this.attrs.move_destination_x;
    let dy = this.attrs.move_destination_y;
    if (this.attrs.move_state === this.STATE_DIRECT) {
      game.with(Player, (p) => {
        dx = p.x;
        dy = p.y;
      });
    }
    if (eq(this.x, dx) && eq(this.y, dy)) {
      this.attrs.move_state = this.STATE_FREE;
      return;
    }
    // The butler moves horizontally before he moves vertically
    let tryVertical = false;
    if (!eq(this.x, dx)) {
      const dist = Math.abs(this.x - dx);
      const dir = this.x > dx ? -1 : 1;
      if (dir === -1 && this.sprite !== getSprite('spr_butler_left')) this.sprite = getSprite('spr_butler_left');
      else if (dir === 1 && this.sprite !== getSprite('spr_butler_right')) this.sprite = getSprite('spr_butler_right');
      const go = dist > this.move_speed ? this.move_speed * dir : dist * dir;
      if (!game.placeMeeting(this, this.x + go, this.y, Barrier)) this.x += go;
      else tryVertical = true;
    } else tryVertical = true;

    if (!eq(this.y, dy) && tryVertical) {
      const dist = Math.abs(this.y - dy);
      const dir = this.y > dy ? -1 : 1;
      if (dir === -1 && this.sprite !== getSprite('spr_butler_up')) this.sprite = getSprite('spr_butler_up');
      else if (dir === 1 && this.sprite !== getSprite('spr_butler_down')) this.sprite = getSprite('spr_butler_down');
      const go = dist > this.move_speed ? this.move_speed * dir : dist * dir;
      if (!game.placeMeeting(this, this.x, this.y + go, Barrier)) this.y += go;
    }
    if (eq(this.x, dx) && eq(this.y, dy)) this.attrs.move_state = this.STATE_FREE;
  }
}

export class Chop extends ItemBase {
  static objName = 'obj_chop';
  override create(): void {
    this.obj_name = 'chop';
    this.list_name = 'A chop';
    this.description = 'A thick, slightly raw cut of what you sure hope is pork.';
    this.item = 'chop';
    this.visible_faraway = false;
    this.sprite = getSprite('spr_chop');
    takeable(this, 'chop_reclaim');
  }
}

export class Dog extends InteractBase {
  static objName = 'obj_dog';
  readonly STATE_RUN = 1;
  readonly STATE_SIT = 2;
  move_speed = MOVESPEED * 1.5;

  override create(): void {
    this.obj_name = 'dog';
    this.list_name = 'A dog';
    this.description = "A vicious looking dog. Don't let appearances fool you, he's vicious.";
    this.visible_nearby = false;
    this.visible_faraway = false;
    this.sprite = getSprite('spr_dog_walk_right');
    this.attrs.move_state = this.STATE_RUN;
  }

  override collisionEvents(): [Ctor, (o: any) => void][] {
    return [
      [
        Player,
        () => {
          if (this.attrs.move_state !== this.STATE_SIT) {
            this.attrs.move_state = this.STATE_SIT;
            die(false);
            showMessage("Oh no, the little doggo has gobbled you right up!\n\nCan't rescue Penelope if you're puppy chow!", this.room);
          }
        },
      ],
      [
        Chop,
        () => {
          if (this.attrs.move_state !== this.STATE_SIT) {
            this.attrs.move_state = this.STATE_SIT;
            showMessage('The dog begins chowing down on the chop. That should keep him busy for a while!', this.room);
          }
        },
      ],
    ];
  }

  override step(): void {
    const game = this.game;
    game.with(Player, (p) => {
      if (p.y < this.y) this.depth = p.depth - 5;
      else if (p.y > this.y) this.depth = p.depth + 5;
    });

    if (this.attrs.move_state === this.STATE_RUN) {
      let dx = this.x;
      let dy = this.y;
      const chop = game.first(Chop);
      if (chop) {
        game.with(Chop, (c) => {
          dx = c.x;
          dy = c.y;
        });
      } else
        game.with(Player, (p) => {
          dx = p.x;
          dy = p.y;
        });

      // The dog moves horizontally before he moves vertically
      if (!eq(this.x, dx)) {
        const dist = Math.abs(this.x - dx);
        const dir = this.x > dx ? -1 : 1;
        if (dir === -1 && this.sprite !== getSprite('spr_dog_walk_left')) this.sprite = getSprite('spr_dog_walk_left');
        else if (dir === 1 && this.sprite !== getSprite('spr_dog_walk_right')) this.sprite = getSprite('spr_dog_walk_right');
        const go = dist > this.move_speed ? this.move_speed * dir : dist * dir;
        if (!game.placeMeeting(this, this.x + go, this.y, Barrier)) this.x += go;
      }
      if (!eq(this.y, dy)) {
        const dist = Math.abs(this.y - dy);
        const dir = this.y > dy ? -1 : 1;
        const go = dist > this.move_speed ? this.move_speed * dir : dist * dir;
        if (!game.placeMeeting(this, this.x, this.y + go, Barrier)) this.y += go;
      }
    } else {
      // Make the dog sit if it is not sitting
      if (this.sprite === getSprite('spr_dog_walk_left')) this.sprite = getSprite('spr_dog_sit_left');
      else if (this.sprite === getSprite('spr_dog_walk_right')) this.sprite = getSprite('spr_dog_sit_right');
    }
  }
}

export class Carpet extends InteractBase {
  static objName = 'obj_carpet';
  override create(): void {
    this.obj_name = 'carpet';
    this.list_name = 'A carpet';
    this.description = 'The edge of the carpet seems to be slightly loose.';
    this.sprite = getSprite('spr_carpet');
    this.triggers.set('remove', () => {
      if (this.game.instanceCreate(Trapdoor, 230, 149, this.depth)) {
        this.game.destroy(this);
        setFlag('carpet_move');
        showMessage('You lift up the carpet and roll it up. There was a trapdoor hidden under the carpet!', this.room);
      }
    });
    for (const verb of ['pull', 'lift', 'move']) this.triggers.set(verb, (cmd) => this.triggers.get('remove')!(cmd));
  }
  override step(): void {
    // Always be underneath the player
    this.game.with(Player, (p) => (this.depth = p.depth + 1));
  }
}

export class Trapdoor extends InteractBase {
  static objName = 'obj_trapdoor';
  override create(): void {
    this.obj_name = 'trapdoor';
    this.list_name = 'A trapdoor';
    this.description = 'A large, rusty trapdoor.';
    this.sprite = getSprite('spr_trap_door');
    this.attrs.locked = true;
    this.triggers.set('look', () => {
      showMessage(this.description + '\nThe oiled hinges should be movable now.', this.room);
    });
    this.triggers.set('open', () => {
      if (!this.attrs.locked) {
        this.game.destroy(this);
        setFlag('trapdoor_open');
        showMessage('The trap door slowly swings open with great effort.', this.room);
      } else showMessage('The hinges are too rusty to move.', this.room);
    });
    this.triggers.set('oil', () => {
      if (inventoryHas('oil')) {
        inventoryRemove('oil');
        this.attrs.locked = false;
        showMessage(TEXT.confirm, this.room);
      } else showMessage("You don't have any.", this.room);
    });
    this.interactions.set('oil', () => {
      inventoryRemove('oil');
      this.attrs.locked = false;
      showMessage(TEXT.confirm, this.room);
    });
  }
  override step(): void {
    this.game.with(Player, (p) => (this.depth = p.depth + 1));
  }
}

// ---- Garden ----

export class GardenShedDoor extends SwingDoor {
  static objName = 'obj_garden_shed_door';
  spriteName = 'spr_hall_door';
  unlock_question = 'The door is locked with a three-digit combination lock. What is the combination?';
  unlock_response = (cmd: string): void => {
    // If the player enters the correct combination, open the door
    if (cmd === '333') {
      this.attrs.unlocked = true;
      // Open the door the first time the player comes back from the message room
      this.attrs.unlock_open = true;
      setFlag('door_combo');
      showMessage('Bingo! The door opens.', this.game.room);
    } else showMessage("The lock rattles but doesn't budge.", this.game.room);
  };

  override create(): void {
    super.create();
    this.attrs.unlocked = false;
    this.attrs.unlock_open = false;
    this.triggers.set('knock', () => showMessage('Nobody answers.', this.room));
    this.triggers.set('unlock', () => {
      if (!this.attrs.unlocked) askQuestion(this.unlock_question, this.room, this.unlock_response);
      else showMessage('The door is already unlocked.', this.room);
    });
    this.triggers.set('open', () => {
      if (this.attrs.unlocked) {
        if (!this.attrs.opened) this.imageSpeed = 1;
      } else askQuestion(this.unlock_question, this.room, this.unlock_response);
    });
  }

  override endStep(): void {
    super.endStep();
    if (this.attrs.unlock_open) {
      this.attrs.unlock_open = false;
      this.imageSpeed = 1;
    }
  }
}

function inShed(game: InteractBase['game']): boolean {
  let inside = false;
  game.with(Player, (p) => (inside = game.placeMeeting(p, p.x, p.y, ShedBounds)));
  return inside;
}

export class Oil extends ItemBase {
  static objName = 'obj_oil';
  dark_text = 'It is too dark to see anything in here.';
  out_of_shed_text = "You'll need to go into the shed first.";
  override create(): void {
    this.obj_name = 'oil';
    this.list_name = 'A can of oil';
    this.description = "It's a small can of oil.";
    this.item = 'oil';
    this.visible_faraway = false;
    this.visible_nearby = false;
    this.interact_distance = 75;
    this.triggers.set('take', () => {
      if (inShed(this.game)) {
        if (inventoryHas('candle')) {
          inventoryAdd(this.item);
          this.game.destroy(this);
          setFlag('oil_take');
          showMessage(TEXT.confirm, this.room);
        } else showMessage(this.dark_text, this.room);
      } else showMessage(this.out_of_shed_text, this.room);
    });
    this.triggers.set('look', () => {
      if (inShed(this.game)) {
        if (inventoryHas('candle')) showMessage(this.description, this.room);
        else showMessage(this.dark_text, this.room);
      } else showMessage(this.out_of_shed_text, this.room);
    });
  }
}

export class Shed extends InteractBase {
  static objName = 'obj_shed';
  out_of_shed_text = "You'll need to go into the shed first.";
  override create(): void {
    this.obj_name = 'shed';
    this.visible_nearby = false;
    this.visible_faraway = false;
    this.list_name = 'A tool shed';
    this.description = "It's too dark to see in here....";
    this.triggers.set('look', () => {
      if (inShed(this.game)) {
        let msg = this.description;
        const oil = this.game.first(Oil);
        if (inventoryHas('candle') && oil) {
          msg += '\n\n...Actually, on a nearby shelf you can just barely make out:';
          msg += '\n- ' + oil.list_name;
        }
        showMessage(msg, this.room);
      } else showMessage(this.out_of_shed_text, this.room);
    });
  }
}

export const HOUSE_OBJECTS: Ctor[] = [
  HhhPumpkin,
  HhhKey,
  HhhFrontdoor,
  Hole,
  Knife,
  Whistle,
  Candle,
  HallDoorLeft,
  HallDoorRight,
  ProfessorHall,
  Bed,
  ClosetDoorLeft,
  ClosetDoorRight,
  Mask,
  Butler,
  Chop,
  Dog,
  Carpet,
  Trapdoor,
  GardenShedDoor,
  Oil,
  Shed,
];

// Keep MaskBase referenced for consumers that need the type.
export type { MaskBase };
