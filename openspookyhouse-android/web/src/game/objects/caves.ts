// Objects below the house: basement, bat cave, mummy room, lake room and
// the dead end with the guard.
import { Ctor, eq, irandom, irandomRange, lengthdirX, lengthdirY, pointDirection, pointDistance } from '../../engine/runtime';
import { getSprite } from '../sprites';
import { g, INPUT_BOX_HEIGHT, MOVESPEED, TEXT } from '../state';
import { askQuestion, die, inventoryAdd, inventoryHas, inventoryRemove, setFlag, showMessage } from '../scripts';
import { BarrierBase, EnemyLethalBase, InteractBase, InteractSolidBase, ItemBase, MaskBase, Player, PlayerHitboxLarge } from './core';

// ---- Bat cave ----

export class BatBase extends EnemyLethalBase {
  static objName = 'obj_bat_base';
  readonly STATE_NORMAL = 0;
  readonly STATE_WHISTLE = 1;
  readonly STATE_MOVE_FREE = 0; // Choosing new destination
  readonly STATE_MOVE_DEST = 1; // Moving to destination
  readonly STATE_MOVE_WAIT = 2; // Waiting to choose new destination
  move_speed_normal = MOVESPEED * 3;
  move_speed_whistle = MOVESPEED;
  move_wait_time_normal = 60 * 2;
  move_wait_time_whistle = 60 * 4;
  bounds_x = 265; // Bats cannot go further than the safe zone

  override create(): void {
    this.sprite = getSprite('spr_bat');
    this.attrs.state = this.STATE_NORMAL;
    this.attrs.move_state = this.STATE_MOVE_FREE;
    this.attrs.move_destination_x = this.x;
    this.attrs.move_destination_y = this.y;
    this.attrs.move_direction = 0;
  }

  override alarmEvent(n: number): void {
    if (n === 0) this.attrs.move_state = this.STATE_MOVE_FREE;
  }

  override collisionEvents(): [Ctor, (o: any) => void][] {
    return [
      [
        PlayerHitboxLarge,
        () => {
          if (!g.game_state.dead) {
            die(false);
            showMessage(
              "Gotcha!&&Looks like one of these vampire bats managed to sink its fangs into you!\n\nNow you'll never rescue poor Penelope.",
              this.room,
            );
          }
        },
      ],
    ];
  }

  override step(): void {
    const game = this.game;
    // Bats are always above everything else
    this.depth = -1000;
    const a = this.attrs;
    switch (a.move_state) {
      case this.STATE_MOVE_FREE: {
        // Randomly decide if we try to move straight to the player
        let toPlayer = false;
        if (irandomRange(1, 50) === 1) {
          game.with(Player, (p) => {
            // Only do so if the player left the safe zone
            if (p.x < this.bounds_x) {
              toPlayer = true;
              a.move_destination_x = p.x;
              a.move_destination_y = p.y;
              a.move_direction = pointDirection(this.x, this.y, a.move_destination_x, a.move_destination_y);
            }
          });
        }
        if (!toPlayer) {
          const sw = this.spriteWidth;
          const sh = this.spriteHeight;
          if (a.state === this.STATE_WHISTLE) a.move_destination_x = irandomRange(sw, game.roomWidth - sw);
          else a.move_destination_x = irandomRange(sw, this.bounds_x);
          if (a.state === this.STATE_WHISTLE) a.move_destination_y = irandomRange(INPUT_BOX_HEIGHT + sh, game.roomHeight * 0.5 - sh);
          else a.move_destination_y = irandomRange(Math.floor(game.roomHeight / 3), game.roomHeight - INPUT_BOX_HEIGHT * 2 - sh);
          a.move_direction = pointDirection(this.x, this.y, a.move_destination_x, a.move_destination_y);
        }
        a.move_state = this.STATE_MOVE_DEST;
        break;
      }
      case this.STATE_MOVE_DEST: {
        const speed = a.state === this.STATE_WHISTLE ? this.move_speed_whistle : this.move_speed_normal;
        if (pointDistance(this.x, this.y, a.move_destination_x, a.move_destination_y) > speed) {
          this.x += lengthdirX(speed, a.move_direction);
          this.y += lengthdirY(speed, a.move_direction);
        } else {
          this.x = a.move_destination_x;
          this.y = a.move_destination_y;
        }
        if (eq(this.x, a.move_destination_x) && eq(this.y, a.move_destination_y)) a.move_state = this.STATE_MOVE_WAIT;
        break;
      }
      case this.STATE_MOVE_WAIT:
        if (this.alarm[0] <= 0) this.alarm[0] = a.state === this.STATE_WHISTLE ? this.move_wait_time_whistle : this.move_wait_time_normal;
        break;
    }
  }
}

export class Bat1 extends BatBase {
  static objName = 'obj_bat_1';
}
export class Bat2 extends BatBase {
  static objName = 'obj_bat_2';
}
export class Bat3 extends BatBase {
  static objName = 'obj_bat_3';
}
export class Bat4 extends BatBase {
  static objName = 'obj_bat_4';
}
export class Bat5 extends BatBase {
  static objName = 'obj_bat_5';
}

// ---- Basement ----

export class BasementDoor extends InteractSolidBase {
  static objName = 'obj_basement_door';
  override create(): void {
    this.obj_name = 'door';
    this.list_name = 'A door';
    this.description = 'A large, heavy door. You see Penelope on the other side!';
    this.visible_faraway = false;
    this.visible_nearby = true;
    this.triggers.set('open', () => showMessage('The door does not open from this side.', this.room));
    this.triggers.set('knock', () => showMessage("Nothing happens. Penelope doesn't seem to notice you.", this.room));
  }
}

// ---- Mummy room ----

export class Gold extends ItemBase {
  static objName = 'obj_gold';
  override create(): void {
    this.obj_name = 'gold';
    this.list_name = 'A bag of gold';
    this.description = "A bag of gold. You're rich!";
    this.item = 'gold';
    this.visible_faraway = false;
    this.sprite = getSprite('spr_gold');
    this.triggers.set('take', () => {
      inventoryAdd(this.item);
      this.game.destroy(this);
      setFlag('gold_take');
      showMessage(TEXT.confirm, this.room);
    });
  }
}

export class Coffin extends InteractSolidBase {
  static objName = 'obj_coffin';
  override solid = true;
  open_delay = 60 * 0.8;
  override create(): void {
    this.obj_name = 'coffin';
    this.list_name = 'A creepy coffin';
    this.description = 'A large, solid coffin.';
    this.sprite = getSprite('spr_mummy_door');
    this.imageSpeed = 0;
    this.attrs.warned = 0;
    // Do not allow the player to open the coffin themselves
    this.triggers.set('open', () => showMessage("It's way too heavy for you to open it.", this.room));
    // Let the player knock on the coffin enough times until it opens
    this.triggers.set('knock', () => {
      if (this.attrs.warned === 0) {
        this.attrs.warned++;
        showMessage('A horrible chill goes down your spine....', this.room);
      } else if (this.attrs.warned === 1) {
        this.attrs.warned++;
        showMessage('Screams echo around you....', this.room);
      } else if (this.attrs.warned === 2) this.imageSpeed = 1;
    });
  }
  override alarmEvent(n: number): void {
    // Begin opening
    if (n === 0) this.imageSpeed = 1;
  }
  override step(): void {
    this.game.with(Player, (p) => (this.depth = p.depth + 1));
    // Begin to open the door once the gold is taken
    if (!this.game.exists(Gold) && this.alarm[0] <= 0 && this.imageSpeed === 0) this.alarm[0] = this.open_delay;
    // Destroy the door once opened
    if (eq(this.imageIndex, this.imageNumber - 1)) this.game.destroy(this);
  }
}

export class Mummy extends InteractBase {
  static objName = 'obj_mummy';
  readonly STATE_INTRO = 0;
  readonly STATE_ATTACK = 1;
  intro_move_distance = 10;
  move_speed = MOVESPEED * 2;

  override create(): void {
    this.obj_name = 'mummy';
    this.list_name = 'Mummy';
    this.description = 'A horrifying mummy. A sense of dread washes over you and a chill goes down your spine.\n\nRun!';
    this.visible_faraway = false;
    this.visible_nearby = false;
    this.interact_distance = 200;
    this.sprite = getSprite('spr_mummy_down');
    this.imageSpeed = 0;
    this.attrs.move_state = this.STATE_INTRO;
    this.attrs.intro_destination_y = 0;
  }

  override collisionEvents(): [Ctor, (o: any) => void][] {
    return [
      [
        Player,
        () => {
          if (!g.game_state.dead) {
            die();
            showMessage(
              "Gotcha!&&The mummy grabs you and squeezes the life out of you with superhuman strength.\n\nIt's curtains for you, and Penelope will remain trapped here.",
              this.room,
            );
          }
        },
      ],
    ];
  }

  private face(name: string): void {
    const s = getSprite(name);
    if (this.sprite !== s) this.sprite = s;
  }

  override step(): void {
    const game = this.game;
    const a = this.attrs;
    if (a.intro_destination_y === 0) a.intro_destination_y = this.y + this.intro_move_distance;

    if (a.move_state === this.STATE_INTRO) {
      // Exit the coffin once it's opened
      if (!game.exists(Coffin)) {
        if (this.y < a.intro_destination_y) {
          this.imageSpeed = 0.5;
          const speed = this.move_speed / 4;
          this.face('spr_mummy_down');
          if (a.intro_destination_y - this.y < speed) this.y = a.intro_destination_y;
          else this.y += speed;
        } else a.move_state = this.STATE_ATTACK;
      } else game.with(Coffin, (c) => (this.depth = c.depth + 1));
      return;
    }
    if (a.move_state !== this.STATE_ATTACK) return;

    let px = this.x;
    let py = this.y;
    let pdepth = this.depth;
    let onPlayer = false;
    game.with(Player, (p) => {
      px = p.x;
      py = p.y;
      pdepth = p.depth;
      onPlayer = eq(p.x, this.x) && eq(p.y, this.y);
    });

    // If we are near the player, adjust depth relative to them
    if (Math.abs(this.x - px) <= this.spriteWidth && Math.abs(this.y - py) <= this.spriteHeight) {
      if (this.y < py) this.depth = pdepth + 1;
      else if (this.y > py) this.depth = pdepth - 1;
    }
    // Now adjust based on masked objects
    const m = game.instancePlace(this, this.x, this.y, MaskBase);
    if (m) {
      if (this.y < m.y + m.offset) this.depth = m.depth + 1;
      else if (this.y > m.y + m.offset) this.depth = m.depth - 1;
    }

    if (onPlayer) {
      this.imageSpeed = 0;
      return;
    }
    this.imageSpeed = 1;
    // Move diagonally to the player first if we can
    if (!eq(this.x, px) && !eq(this.y, py)) {
      const xdir = this.x < px ? 1 : -1;
      const ydir = this.y < py ? 1 : -1;
      if (this.x < px) this.face('spr_mummy_right');
      else if (this.x > px) this.face('spr_mummy_left');
      let sx = this.move_speed / 2;
      let sy = this.move_speed / 2;
      if (Math.abs(this.x - px) < sx) sx = Math.abs(this.x - px);
      if (Math.abs(this.y - py) < sy) sy = Math.abs(this.y - py);
      const speed = Math.min(sx, sy);
      if (!game.placeMeeting(this, this.x + speed * xdir, this.y + speed * ydir, BarrierBase)) {
        this.imageSpeed = 1;
        this.x += speed * xdir;
        this.y += speed * ydir;
      } else this.imageSpeed = 0;
    }
    // Then check horizontally
    if (!eq(this.x, px)) {
      let speed = this.move_speed;
      if (Math.abs(this.x - px) < speed) speed = Math.abs(this.x - px);
      if (this.x < px) {
        this.face('spr_mummy_right');
        if (!game.placeMeeting(this, this.x + speed, this.y, BarrierBase)) {
          this.imageSpeed = 1;
          this.x += speed;
        } else this.imageSpeed = 0;
      } else {
        this.face('spr_mummy_left');
        if (!game.placeMeeting(this, this.x - speed, this.y, BarrierBase)) {
          this.imageSpeed = 1;
          this.x -= speed;
        } else this.imageSpeed = 0;
      }
    } else {
      // Now that we're horizontally lined up with the player, move vertically
      let speed = this.move_speed;
      if (Math.abs(this.y - py) < speed) speed = Math.abs(this.y - py);
      if (this.y < py) {
        this.face('spr_mummy_down');
        if (!game.placeMeeting(this, this.x, this.y + speed, BarrierBase)) {
          this.imageSpeed = 1;
          this.y += speed;
        } else this.imageSpeed = 0;
      } else {
        this.face('spr_mummy_up');
        if (!game.placeMeeting(this, this.x, this.y - speed, BarrierBase)) {
          this.imageSpeed = 1;
          this.y -= speed;
        } else this.imageSpeed = 0;
      }
    }
  }
}

// ---- Lake room ----

export class Rope extends ItemBase {
  static objName = 'obj_rope';
  override create(): void {
    this.obj_name = 'rope';
    this.list_name = 'A rope';
    this.description = 'A rope that has been tied tightly to secure the boat to the dock.';
    this.visible_faraway = false;
    this.sprite = getSprite('spr_rope_tether');
    this.attrs.cut = false;
    this.triggers.set('look', () => {
      if (this.attrs.cut) showMessage('A rope that used to secure the boat to the dock.', this.room);
      else showMessage(this.description, this.room);
    });
    this.triggers.set('untie', () => {
      showMessage("Try as you might, whoever tied this rope knew their knots. It won't budge.", this.room);
    });
    this.triggers.set('cut', () => {
      if (inventoryHas('knife')) {
        if (!this.attrs.cut) {
          this.attrs.cut = true;
          showMessage(TEXT.confirm, this.room);
        } else showMessage("That doesn't seem like a good use of your time.", this.room);
      } else showMessage('With what?', this.room);
    });
    this.interactions.set('knife', (cmd) => this.triggers.get('cut')!(cmd));
  }
  override step(): void {
    if (this.attrs.cut && this.sprite !== getSprite('spr_rope_cut')) this.sprite = getSprite('spr_rope_cut');
    super.step();
  }
}

export class Boat extends ItemBase {
  static objName = 'obj_boat';
  readonly POSITION_BOTTOM = 0;
  readonly POSITION_TOP = 1;
  readonly POSITION_MOVING = 2;
  bottom_pos_x = 256;
  bottom_pos_y = 130;
  top_pos_x = 156;
  top_pos_y = 60;
  move_speed = MOVESPEED / 2;

  override create(): void {
    this.obj_name = 'boat';
    this.list_name = 'A boat';
    this.description = "An old boat. It doesn't look like it's in the best shape, but it should be usable.";
    this.visible_faraway = false;
    this.sprite = getSprite('spr_boat_empty');
    const a = this.attrs;
    a.plugged = false;
    a.manned = false;
    a.position = this.POSITION_BOTTOM;
    a.destination = this.POSITION_BOTTOM;
    a.move_destination_x = 0;
    a.move_destination_y = 0;

    this.triggers.set('enter', () => {
      if (!this.attrs.plugged)
        showMessage(
          "On careful inspection, you notice a hole in the bottom of the boat. Better not risk getting in the boat in its current state, or you'll likely sink to the bottom of the lake before you can get across.",
          this.room,
        );
      else if (!this.attrs.manned) {
        this.attrs.manned = true;
        this.game.destroyAll(Player);
        showMessage(TEXT.confirm, this.room);
      } else showMessage('How would one get into a boat twice?', this.room);
    });

    this.triggers.set('exit', () => {
      const at = this.attrs;
      if (!at.manned) {
        showMessage("You're not in the boat.", this.room);
        return;
      }
      if (at.position === this.POSITION_BOTTOM) {
        at.manned = false;
        const p = this.game.instanceCreate(Player, this.x, this.y + 20, this.depth);
        p.sprite = getSprite('spr_hugo_mini_down');
        showMessage(TEXT.confirm, this.room);
      } else if (at.position === this.POSITION_TOP) {
        // Make sure the old man will allow the player to exit
        let mayPass = false;
        this.game.with(OldMan, (o) => (mayPass = o.attrs.may_pass));
        if (mayPass) {
          at.manned = false;
          const p = this.game.instanceCreate(Player, this.x, this.y - 15, this.depth);
          p.sprite = getSprite('spr_hugo_mini_up');
          showMessage(TEXT.confirm, this.room);
        } else showMessage('The old man blocks your path!', this.room);
      } else
        showMessage(
          'If you jumped out of the boat right now, you would be pulled all over the lake by the current and drown!',
          this.room,
        );
    });

    this.triggers.set('plug', () => {
      if (inventoryHas('bung')) {
        inventoryRemove('bung');
        this.attrs.plugged = true;
        showMessage(TEXT.confirm, this.room);
      } else showMessage('With what?', this.room);
    });

    this.triggers.set('get', (cmd) => {
      const word = cmd?.[1];
      if (word === 'in' || word === 'into') this.triggers.get('enter')!(cmd);
      else if (word === 'out') this.triggers.get('exit')!(cmd);
      else showMessage(TEXT.default_error, this.room);
    });

    this.triggers.set('push', () => {
      const at = this.attrs;
      if (at.position === this.POSITION_MOVING) {
        showMessage('The boat is already moving.', this.room);
        return;
      }
      let ropeCut = false;
      this.game.with(Rope, (r) => (ropeCut = r.attrs.cut));
      if (!ropeCut) showMessage('You give the boat a solid push, but the rope prevents it from moving.', this.room);
      else if (!at.plugged) showMessage("You notice a hole in the bottom of the boat. Better not move the boat before that's fixed.", this.room);
      else {
        at.destination = at.position === this.POSITION_BOTTOM ? this.POSITION_TOP : this.POSITION_BOTTOM;
        at.move_destination_x = 0;
        at.move_destination_y = 0;
        at.position = this.POSITION_MOVING;
      }
    });

    this.interactions.set('bung', (cmd) => this.triggers.get('plug')!(cmd));
  }

  override step(): void {
    const game = this.game;
    const a = this.attrs;
    if (a.manned && this.sprite !== getSprite('spr_boat_full')) this.sprite = getSprite('spr_boat_full');
    else if (!a.manned && this.sprite !== getSprite('spr_boat_empty')) this.sprite = getSprite('spr_boat_empty');

    game.with(Player, (p) => {
      if (p.y < this.y) this.depth = p.depth - 1;
      else if (p.y > this.y) this.depth = p.depth + 1;
    });

    if (a.position !== this.POSITION_MOVING) return;
    if (a.move_destination_x === 0) {
      // Go to a midpoint and then directly to the destination
      a.move_destination_x = Math.round((this.top_pos_x + this.bottom_pos_x) / 2);
      a.move_destination_y = Math.round((this.top_pos_y + this.bottom_pos_y) / 2);
    }
    const chastise = "I bet you feel real smart right now. Now how are you going to get across?";
    if (eq(this.x, a.move_destination_x) && eq(this.y, a.move_destination_y)) {
      if (eq(a.move_destination_x, this.bottom_pos_x)) {
        a.position = this.POSITION_BOTTOM;
        if (game.exists(Player)) showMessage(chastise, this.room);
      } else if (eq(a.move_destination_x, this.top_pos_x)) {
        a.position = this.POSITION_TOP;
        if (game.exists(Player)) showMessage(chastise, this.room);
      } else if (a.destination === this.POSITION_TOP) {
        a.move_destination_x = this.top_pos_x;
        a.move_destination_y = this.top_pos_y;
      } else {
        a.move_destination_x = this.bottom_pos_x;
        a.move_destination_y = this.bottom_pos_y;
      }
      return;
    }
    // Move diagonally to the destination first if we can
    if (!eq(this.x, a.move_destination_x) && !eq(this.y, a.move_destination_y)) {
      const xdir = this.x < a.move_destination_x ? 1 : -1;
      const ydir = this.y < a.move_destination_y ? 1 : -1;
      let sx = this.move_speed / 2;
      let sy = this.move_speed / 2;
      if (Math.abs(this.x - a.move_destination_x) < sx) sx = Math.abs(this.x - a.move_destination_x);
      if (Math.abs(this.y - a.move_destination_y) < sy) sy = Math.abs(this.y - a.move_destination_y);
      const speed = Math.min(sx, sy);
      this.x += speed * xdir;
      this.y += speed * ydir;
    }
    // Then check horizontally
    if (!eq(this.x, a.move_destination_x)) {
      let speed = this.move_speed;
      if (Math.abs(this.x - a.move_destination_x) < speed) speed = Math.abs(this.x - a.move_destination_x);
      if (this.x < a.move_destination_x) this.x += speed;
      else this.x -= speed;
    } else {
      // Horizontally lined up with the destination, move vertically
      let speed = this.move_speed;
      if (Math.abs(this.y - a.move_destination_y) < speed) speed = Math.abs(this.y - a.move_destination_y);
      if (this.y < a.move_destination_y) this.y += speed;
      else this.y -= speed;
    }
  }
}

interface Question {
  question: string;
  answer: string;
}

export class OldMan extends ItemBase {
  static objName = 'obj_oldman';
  readonly STATE_IDLE = 0;
  readonly STATE_QUESTIONS = 1;
  readonly STATE_ASK = 2;
  questions_to_ask = 5;
  questions: Question[] = [
    { question: "What was the first name of the hero in 'The Hobbit'?", answer: 'bilbo' },
    { question: 'Where did Aslan live?\n(Hint: Not in a wardrobe!)', answer: 'narnia' },
    { question: 'Who invented Count Dracula?', answer: 'bram stoker' },
    {
      question: 'What should you do with a\nPan-galactic gargle blaster?\n(a) Ride it\n(b) Fire it\n(c) Drink it\n(d) Run away from it',
      answer: 'c',
    },
    { question: "What's the name of the only mammal that can't fly that can fly?", answer: 'man' },
    { question: "What was the name of Roy Rogers' dog?", answer: 'bullet' },
    { question: "What is the first and last name of the original creator of Hugo's House of Horrors?", answer: 'david gray' },
    // NOTE: This must ALWAYS be the last question in the array
    { question: 'Are you sure you want to rescue Penelope?', answer: 'yes' },
  ];
  responses = [
    'Oho, very good! Next question.',
    'Mm, indeed. And now....',
    "That's right! Moving on.",
    'Yes, yes. Next....',
    "Indubitably. Let's see, what else....",
    'Correct! Another question:',
    'That was an easy one. But how about this one!',
    "I didn't think you would get that one. Let's try another.",
    "Are you sure? Oh wait, that's right. How about....",
  ];

  override create(): void {
    this.obj_name = 'man';
    this.list_name = 'An old man';
    this.description = 'An old man sitting at the dock. He looks ancient - easily 200 years old!';
    this.visible_faraway = false;
    this.sprite = getSprite('spr_old_man');
    this.attrs.state = this.STATE_IDLE;
    this.attrs.questions_asked = [];
    this.attrs.current_question = 0;
    this.attrs.may_pass = false;

    this.triggers.set('talk', () => {
      if (this.attrs.may_pass) showMessage("'Good luck, my friend!'", this.room);
      else if (this.attrs.state === this.STATE_IDLE) {
        // The actual questions are handled in the step event
        this.attrs.state = this.STATE_QUESTIONS;
        this.attrs.questions_asked = [];
        showMessage(
          'The old man speaks in a frail, soft voice:&&' +
            'Welcome to my lake. I have been waiting for you, Hugo! I know you and your quest, ' +
            'but before you may pass you must answer my questions five. Otherwise ' +
            'you will be doomed to float on the lake for all eternity!&&' +
            'I will only accept your first answer for each question. Make it count!&&' +
            'The old man clears his throat and asks:',
          this.room,
        );
      } else showMessage('You should answer his questions.', this.room);
    });
  }

  override alarmEvent(n: number): void {
    if (n !== 0) return;
    const a = this.attrs;
    if (a.questions_asked.length >= this.questions_to_ask) {
      a.state = this.STATE_IDLE;
      a.may_pass = true;
      setFlag('questions_answer');
      showMessage(
        'Excellent! You possess the knowledge and experience of a seasoned adventurer. Go forth, young Hugo, and rescue Penelope!&&The old man smiles and moves aside, allowing you to pass!',
        this.room,
      );
      return;
    }
    a.state = this.STATE_ASK;
    let header = '';
    // Tack a header onto the question if this is not the first question asked
    if (a.questions_asked.length > 0) header = this.responses[irandomRange(0, this.responses.length - 1)];
    // The actual question goes on a second page of the message
    if (header !== '') header += '&&';
    a.current_question = -1;
    for (;;) {
      // Always ask the final question last
      if (a.questions_asked.length === this.questions_to_ask - 1) {
        a.current_question = this.questions.length - 1;
        a.questions_asked.push(a.current_question);
        break;
      }
      a.current_question = irandomRange(0, this.questions.length - 2);
      if (!a.questions_asked.includes(a.current_question)) {
        a.questions_asked.push(a.current_question);
        break;
      }
    }
    askQuestion(header + this.questions[a.current_question].question, this.room, (cmd) => {
      if (cmd !== this.questions[this.attrs.current_question].answer) {
        this.attrs.state = this.STATE_IDLE;
        this.attrs.may_pass = false;
        showMessage(
          "I'm sorry, that is incorrect.&&Since you failed to answer my questions, I hereby doom you to float forever on my lake!",
          this.game.room,
        );
      } else this.attrs.state = this.STATE_QUESTIONS;
    });
  }

  override step(): void {
    let playerExists = false;
    this.game.with(Player, (p) => {
      playerExists = true;
      if (p.y < this.y) this.depth = p.depth - 1;
      else if (p.y > this.y) this.depth = p.depth + 1;
    });
    // If the player is in the boat, adjust depth based on the boat
    if (!playerExists) this.game.with(Boat, (b) => (this.depth = b.depth + 1));
    // Ask the player questions
    if (this.attrs.state === this.STATE_QUESTIONS && this.alarm[0] <= 0) this.alarm[0] = 10;
  }
}

// ---- Dead end ----

export class Guard extends InteractSolidBase {
  static objName = 'obj_guard';
  readonly STATE_FREE = 0;
  readonly STATE_PAID = 1;
  move_speed = MOVESPEED;

  override create(): void {
    this.obj_name = 'guard';
    this.list_name = 'A guard';
    this.description = 'A large man guarding a door immediately behind him.';
    this.visible_faraway = false;
    this.visible_nearby = false;
    this.interact_distance = 30;
    this.sprite = getSprite('spr_guard_down');
    this.imageSpeed = 0;
    this.attrs.move_state = this.STATE_FREE;
    this.attrs.move_destination = 120;
    this.triggers.set('talk', () => showMessage('The guard ignores you.', this.room));
    this.triggers.set('give', (cmd) => {
      // Check if the player specifically mentioned giving money to the guard
      const words = cmd ?? [];
      const mentionedMoney = words.slice(1).some((w) => w === 'gold' || w === 'money');
      if (mentionedMoney) {
        if (inventoryHas('gold')) {
          inventoryRemove('gold');
          this.attrs.move_state = this.STATE_PAID;
          setFlag('gold_give');
          showMessage('The guard takes the gold with a smirk and stands aside, letting you pass!', this.room);
        } else showMessage("You don't have any.", this.room);
      } else showMessage('The guard grunts and refuses.', this.room);
    });
  }

  override step(): void {
    this.game.with(Player, (p) => {
      if (p.y < this.y) this.depth = p.depth - 5;
      else if (p.y > this.y) this.depth = p.depth + 5;
    });
    if (this.attrs.move_state === this.STATE_PAID && !eq(this.x, this.attrs.move_destination)) {
      if (this.sprite !== getSprite('spr_guard_left')) {
        this.sprite = getSprite('spr_guard_left');
        this.imageSpeed = 1;
      }
      if (Math.abs(this.x - this.attrs.move_destination) >= this.move_speed) this.x -= this.move_speed;
      else this.x -= Math.abs(this.x - this.attrs.move_destination);
    } else if (this.sprite !== getSprite('spr_guard_down')) {
      this.sprite = getSprite('spr_guard_down');
      this.imageSpeed = 0;
    }
  }
}

export const CAVE_OBJECTS: Ctor[] = [BatBase, Bat1, Bat2, Bat3, Bat4, Bat5, BasementDoor, Gold, Coffin, Mummy, Rope, Boat, OldMan, Guard];

// Silence unused-import warnings for helpers kept for parity with the GML.
void irandom;
