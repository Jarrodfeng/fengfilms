// The mad scientist's lab: sliding glass door, Igor, the professor, the
// electric arc that transforms Hugo, the table and the rubber bung.
import { Ctor, eq, irandom, irandomRange } from '../../engine/runtime';
import { DrawList } from '../../render/drawlist';
import { getSprite } from '../sprites';
import { g, MOVESPEED, STATUS_BUTLER, STATUS_DIZZY, STATUS_MINI, STATUS_MUMMY, STATUS_NORMAL, STATUS_STATIC, TEXT } from '../state';
import { inventoryAdd, setFlag, setStatus, showMessage } from '../scripts';
import { CubicleBounds, DoorAutoclose, InteractBase, MvLabHall, Player, StateBase } from './core';

function playerInCubicle(game: InteractBase['game']): boolean {
  let inside = false;
  game.with(Player, (p) => (inside = game.placeMeeting(p, p.x, p.y, CubicleBounds)));
  return inside;
}

export class LabDoor extends DoorAutoclose {
  static objName = 'obj_lab_door';
  closed_pos = 126;
  open_pos = 80;
  door_move_wait = 60 * 1.5;
  move_speed_close = MOVESPEED * 2;
  move_speed_open = MOVESPEED;
  move_speed = MOVESPEED * 2;

  override create(): void {
    this.obj_name = 'door';
    this.list_name = 'A door';
    this.description = 'A sliding glass door.';
    this.visible_faraway = false;
    this.visible_nearby = false;
    this.sprite = getSprite('spr_glassdoor');
    this.imageSpeed = 0;
    this.attrs.opened = false;
    this.attrs.failsafe = false;
    this.attrs.move_destination = this.open_pos;
  }

  override alarmEvent(n: number): void {
    if (n === 0) {
      // Close door
      this.move_speed = this.move_speed_close;
      this.attrs.move_destination = this.closed_pos;
    } else if (n === 1) {
      // Open door
      this.move_speed = this.move_speed_open;
      this.attrs.move_destination = this.open_pos;
    }
  }

  override beginStep(): void {
    // Open again if the player is not in the cubicle while closing
    if (this.attrs.move_destination === this.closed_pos) {
      this.game.with(Player, (p) => {
        if (!this.game.placeMeeting(p, p.x, p.y, CubicleBounds)) {
          this.attrs.move_destination = this.open_pos;
          this.attrs.failsafe = true;
        }
      });
    }
  }

  override step(): void {
    const game = this.game;
    super.step();
    const dest = this.attrs.move_destination;
    if (this.x > dest) {
      if (Math.abs(this.x - dest) > this.move_speed) this.x -= this.move_speed;
      else this.x -= Math.abs(this.x - dest);
    } else if (this.x < dest) {
      if (Math.abs(dest - this.x) > this.move_speed) this.x += this.move_speed;
      else this.x += Math.abs(dest - this.x);
    }

    if (eq(this.x, this.closed_pos) && this.attrs.opened) {
      this.attrs.opened = false;
      game.with(Arc, (a) => {
        a.sprite = getSprite('spr_arc');
        a.alarm[0] = a.flash_time;
      });
      game.with(ProfessorLab, (p) => (p.attrs.state = p.STATE_CUBICLE));
    } else if (eq(this.x, this.open_pos)) {
      this.attrs.opened = true;
      const showFailsafe = this.attrs.failsafe;
      const profInRoom = game.exists(ProfessorLab);
      this.attrs.failsafe = false;
      if (showFailsafe && !profInRoom)
        showMessage('Igor glares at you and yells incoherently. Apparently you should stay in the cubicle while the machine is running.', this.room);
      else
        game.with(ProfessorLab, (p) => {
          if (p.attrs.state === p.STATE_CUBICLE) p.attrs.state = p.STATE_FRUSTRATION;
        });
    }
  }
}

/** Not an interactable: a flash of electricity in the cubicle. */
export class Arc extends StateBase {
  static objName = 'obj_arc';
  obj_name = 'arc';
  list_name = 'A shocking arc of electricity';
  description = "Don't touch it.";
  flash_time = 60 * 3;

  override alarmEvent(n: number): void {
    if (n !== 0) return;
    // Transform the player as needed
    this.sprite = null;
    switch (g.game_state.status) {
      case STATUS_NORMAL:
      case STATUS_MUMMY:
      case STATUS_BUTLER:
        setStatus(STATUS_DIZZY);
        break;
      case STATUS_DIZZY:
        setStatus(STATUS_STATIC);
        break;
      case STATUS_STATIC:
        setStatus(STATUS_MINI);
        break;
      case STATUS_MINI:
        setStatus(STATUS_NORMAL);
        break;
    }
    this.game.with(LabDoor, (d) => (d.alarm[1] = d.door_move_wait));
  }

  override draw(list: DrawList): void {
    if (this.sprite) this.drawSelf(list);
  }
}

export class LabTable extends InteractBase {
  static objName = 'obj_lab_table';
  override create(): void {
    this.obj_name = 'table';
    this.list_name = 'A table';
    this.visible_nearby = true;
    this.visible_faraway = false;
    this.description = 'Various instruments are strewn about the table.';
    this.triggers.set('look', () => {
      let msg = this.description;
      if (this.game.exists(Bung)) msg += '\n\nAmong them is a rubber bung that looks out of place.';
      showMessage(msg, this.room);
    });
  }
}

export class Bung extends InteractBase {
  static objName = 'obj_bung';
  item = 'bung';
  override create(): void {
    this.obj_name = 'bung';
    this.list_name = 'A rubber bung';
    this.description = 'Looks waterproof. Good for plugging holes.';
    this.sprite = getSprite('spr_bung');
    this.visible_nearby = false;
    this.visible_faraway = false;
    this.interact_distance = 10;
    this.triggers.set('take', () => {
      inventoryAdd(this.item);
      this.game.destroy(this);
      setFlag('bung_take');
      showMessage(TEXT.confirm, this.room);
    });
  }
}

export class Igor extends InteractBase {
  static objName = 'obj_igor';
  readonly STATE_FREE = 0;
  readonly STATE_RED = 1;
  readonly STATE_YELLOW = 2;
  readonly STATE_GREEN = 3;
  readonly STATE_BLUE = 4;
  readonly STATE_WANDER = 5;
  move_wait_time = 60 * 2.5;
  left_bounds = 168;
  right_bounds = 280;
  red_pos = 188;
  yellow_pos = 199;
  green_pos = 210;
  blue_pos = 221;
  move_speed_wander = MOVESPEED / 2;
  move_speed_direct = MOVESPEED;
  move_speed = MOVESPEED / 2;

  override create(): void {
    this.obj_name = 'igor';
    this.list_name = 'Igor';
    this.description = "A large, green man. He doesn't seem hostile but he definitely isn't friendly.";
    this.visible_faraway = false;
    this.visible_nearby = false;
    this.interact_distance = 300;
    this.sprite = getSprite('spr_igor_right');
    this.imageSpeed = 0;
    this.attrs.move_state = this.STATE_WANDER;
    this.attrs.move_destination = irandomRange(this.left_bounds, this.right_bounds);
    this.attrs.last_button = this.STATE_FREE;

    // Move Igor to a button when told to
    this.triggers.set('tell', (cmd) => {
      const words = cmd ?? [];
      let validTell = false;
      let color = -1;
      const profInRoom = this.game.exists(ProfessorLab);
      const validWords = ['push', 'press', 'hit', 'button', 'switch'];
      const validColors = ['red', 'yellow', 'green', 'blue'];
      if (words.length > 2) {
        for (let c = 2; c < words.length; c++) {
          if (validWords.includes(words[c])) validTell = true;
          const ci = validColors.indexOf(words[c]);
          if (ci !== -1) {
            validTell = true;
            color = ci;
          }
        }
      }
      if (!validTell || profInRoom) {
        showMessage("Igor ignores you. Apparently he didn't find what you said useful.", this.room);
        return;
      }
      // Only make Igor listen if the player is in the cubicle
      if (!playerInCubicle(this.game)) {
        showMessage('Igor nods toward the cubicle, urging you to get in first.', this.room);
        return;
      }
      if (this.attrs.move_state !== this.STATE_FREE && this.attrs.move_state !== this.STATE_WANDER) return;
      this.alarm[0] = -1;
      // Igor randomly chooses a button, but never the one the player asks for
      if (color !== -1) validColors.splice(color, 1);
      const pick = validColors[irandom(validColors.length - 1)];
      const target: Record<string, [number, number]> = {
        yellow: [this.STATE_YELLOW, this.yellow_pos],
        green: [this.STATE_GREEN, this.green_pos],
        blue: [this.STATE_BLUE, this.blue_pos],
        red: [this.STATE_RED, this.red_pos],
      };
      const [state, pos] = target[pick] ?? target.red;
      this.attrs.move_state = state;
      this.attrs.move_destination = pos;
      this.move_speed = this.move_speed_direct;
    });
  }

  override alarmEvent(n: number): void {
    if (n !== 0) return;
    // Determine new destination
    this.attrs.move_destination = irandomRange(this.left_bounds, this.right_bounds);
    this.attrs.move_state = this.STATE_WANDER;
  }

  override step(): void {
    const game = this.game;
    game.with(Player, (p) => {
      if (p.y < this.y) this.depth = p.depth - 5;
      else if (p.y > this.y) this.depth = p.depth + 5;
    });
    const a = this.attrs;
    if (eq(this.x, a.move_destination) && a.move_state !== this.STATE_FREE) {
      // Stop moving and wait to pick a new destination
      this.imageIndex = 0;
      this.imageSpeed = 0;
      const state = a.move_state;
      a.move_state = this.STATE_FREE;
      this.move_speed = this.move_speed_wander;
      this.alarm[0] = this.move_wait_time;
      const names: Record<number, string> = {
        [this.STATE_RED]: 'RED',
        [this.STATE_YELLOW]: 'YELLOW',
        [this.STATE_BLUE]: 'BLUE',
        [this.STATE_GREEN]: 'GREEN',
      };
      if (names[state]) {
        a.last_button = state;
        game.with(LabDoor, (d) => (d.attrs.move_destination = d.closed_pos));
        showMessage('Igor grunts and proceeds to press the ' + names[state] + ' button!', this.room);
      }
    } else if (this.x > a.move_destination) {
      if (this.sprite !== getSprite('spr_igor_left')) this.sprite = getSprite('spr_igor_left');
      this.imageSpeed = 1;
      if (Math.abs(this.x - a.move_destination) > this.move_speed) this.x -= this.move_speed;
      else this.x -= Math.abs(this.x - a.move_destination);
    } else if (this.x < a.move_destination) {
      if (this.sprite !== getSprite('spr_igor_right')) this.sprite = getSprite('spr_igor_right');
      this.imageSpeed = 1;
      if (Math.abs(a.move_destination - this.x) > this.move_speed) this.x += this.move_speed;
      else this.x += Math.abs(a.move_destination - this.x);
    }
  }
}

export class ProfessorLab extends InteractBase {
  static objName = 'obj_professor_lab';
  readonly STATE_INTRODUCTION = 1;
  readonly STATE_WAIT = 2;
  readonly STATE_IGOR = 3;
  readonly STATE_CUBICLE = 4;
  readonly STATE_FRUSTRATION = 5;
  readonly STATE_LEAVE = 6;
  introduction_destination = 170;
  wait_speed = 60;

  override create(): void {
    this.obj_name = 'professor';
    this.list_name = 'The Professor';
    this.description = 'A man in a lab coat. He gives off serious mad scientist vibes.';
    this.visible_faraway = false;
    this.visible_nearby = false;
    this.interact_distance = 1;
    this.sprite = getSprite('spr_prof_right');
    this.imageSpeed = 1;
    this.y = 168;
    this.attrs.state = this.STATE_INTRODUCTION;
    this.attrs.waiting = false;
  }

  override alarmEvent(n: number): void {
    if (n === 0) {
      // Say introduction
      this.attrs.state = this.STATE_WAIT;
      showMessage(
        "The mad scientist speaks:\n\nThere you are! You're late. There isn't much time left, so we need to get started right away. Please, step into the cubicle.",
        this.room,
      );
    } else if (n === 1) {
      // Command Igor
      this.attrs.state = this.STATE_IGOR;
      showMessage('"Excellent! Very well Igor, press the green button!"', this.room);
    }
  }

  override collisionEvents(): [Ctor, (o: any) => void][] {
    return [[MvLabHall, () => this.game.destroy(this)]];
  }

  override step(): void {
    const game = this.game;
    super.step();
    const inPosition = playerInCubicle(game);
    const a = this.attrs;
    switch (a.state) {
      case this.STATE_INTRODUCTION:
        if (eq(this.x, this.introduction_destination)) {
          this.sprite = getSprite('spr_prof_left');
          this.imageIndex = 0;
          this.imageSpeed = 0;
          if (this.alarm[0] === -1) this.alarm[0] = this.wait_speed;
        } else if (Math.abs(this.introduction_destination - this.x) > MOVESPEED / 2) this.x += MOVESPEED / 2;
        else this.x += Math.abs(this.introduction_destination - this.x);
        break;
      case this.STATE_WAIT:
        if (inPosition && this.alarm[1] === -1) this.alarm[1] = this.wait_speed;
        break;
      case this.STATE_IGOR:
        if (inPosition) {
          if (!a.waiting) {
            a.waiting = true;
            game.with(Igor, (i) => {
              if (i.attrs.move_state !== i.STATE_RED) {
                i.attrs.move_destination = i.red_pos;
                i.attrs.move_state = i.STATE_RED;
                i.move_speed = i.move_speed_direct;
              }
            });
          }
        } else {
          // The player stepped out: stop Igor and scold the player
          a.waiting = false;
          game.with(Igor, (i) => {
            i.imageIndex = 0;
            i.imageSpeed = 0;
            i.attrs.move_state = i.STATE_WANDER;
            i.move_speed = i.move_speed_wander;
            i.attrs.move_destination = irandomRange(i.left_bounds, i.right_bounds);
          });
          a.state = this.STATE_WAIT;
          showMessage(
            'The professor looks at you angrily and speaks:\n\nHEY! Get back in the cubicle! We have to get this right the first time, quit screwing around.',
            this.room,
          );
        }
        break;
      case this.STATE_FRUSTRATION:
        a.state = this.STATE_LEAVE;
        showMessage(
          '"IDIOT! A colorblind minion, that\'s just what I need. This experiment is ruined."\n\nThe professor storms off while grumbling to himself, leaving you alone in the room with Igor....',
          this.room,
        );
        break;
      case this.STATE_LEAVE:
        this.imageSpeed = 1;
        this.x -= MOVESPEED * 1.5;
        break;
    }
  }
}

export const LAB_OBJECTS: Ctor[] = [LabDoor, Arc, LabTable, Bung, Igor, ProfessorLab];

void STATUS_MINI;
