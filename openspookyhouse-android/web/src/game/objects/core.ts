// Base objects, the player, depth masks, barriers and room transitions.
import { Instance, Ctor } from '../../engine/runtime';
import { getSprite, DEBUG_SPRITES } from '../sprites';
import {
  g,
  INTERACT_DISTANCE,
  MOVESPEED,
  NO_ROOM,
  STATUS_DEAD,
  STATUS_DIZZY,
  STATUS_HEADLESS,
  STATUS_MINI,
  STATUS_NORMAL,
  STATUS_STATIC,
  STATUS_WON,
} from '../state';
import {
  inventoryHas,
  inventoryRemove,
  roomTransition,
  saveRoomState,
  setFlag,
  setStatus,
  showMessage,
} from '../scripts';

export const VK = {
  backspace: 8,
  enter: 13,
  escape: 27,
  space: 32,
  left: 37,
  up: 38,
  right: 39,
  down: 40,
  n: 78,
  y: 89,
  numpad2: 98,
  numpad4: 100,
  numpad6: 102,
  numpad8: 104,
  f1: 112,
  f2: 113,
  f3: 114,
  f4: 115,
  f5: 116,
  f6: 117,
  f11: 122,
};

export type Trigger = (cmd?: string[]) => void;

/** obj_state_base: objects whose state is remembered per room. */
export class StateBase extends Instance {
  static objName = 'obj_state_base';
}

/** obj_interact_base: anything the parser can refer to. */
export class InteractBase extends StateBase {
  static objName = 'obj_interact_base';
  obj_name = '';
  description = '';
  list_name = '';
  triggers = new Map<string, Trigger>();
  interactions = new Map<string, Trigger>();
  visible_nearby = true;
  visible_faraway = true;
  attrs: any = {};
  interact_distance = INTERACT_DISTANCE;

  get room(): string {
    return this.game.room;
  }

  override step(): void {
    // Adjust depth based on player position
    this.game.with(Player, (p) => {
      if (p.y < this.y) this.depth = p.depth - 1;
      else if (p.y > this.y) this.depth = p.depth + 1;
    });
  }
}

export class InteractSolidBase extends InteractBase {
  static objName = 'obj_interact_solid_base';
}

export class ItemBase extends InteractBase {
  static objName = 'obj_item_base';
  item = '';
}

export class EnemyBase extends InteractBase {
  static objName = 'obj_enemy_base';
}

export class EnemyLethalBase extends EnemyBase {
  static objName = 'obj_enemy_lethal_base';
}

export class DoorAutoclose extends InteractSolidBase {
  static objName = 'obj_door_autoclose';
}

// ---- Barriers, bounds and other invisible helpers ----

export class BarrierBase extends Instance {
  static objName = 'obj_barrier_base';
  override create(): void {
    this.solid = true;
    this.visible = false;
    this.depth = -10000;
  }
}

export class Barrier extends BarrierBase {
  static objName = 'obj_barrier';
  override create(): void {
    super.create();
    this.sprite = DEBUG_SPRITES.spr_debug_red;
  }
  override step(): void {
    this.visible = g.SHOW_BARRIERS;
  }
}

export class BoundsBase extends Instance {
  static objName = 'obj_bounds_base';
  override create(): void {
    this.visible = false;
    this.depth = -10000;
    this.sprite = DEBUG_SPRITES.spr_debug_blue;
  }
  override step(): void {
    this.visible = g.SHOW_BARRIERS;
  }
}

export class CubicleBounds extends BoundsBase {
  static objName = 'obj_cubicle_bounds';
}

export class ShedBounds extends BoundsBase {
  static objName = 'obj_shed_bounds';
}

export class PlayerHitboxLarge extends Instance {
  static objName = 'obj_player_hitbox_large';
  override create(): void {
    this.sprite = DEBUG_SPRITES.spr_debug_playermask;
    this.visible = false;
  }
  override step(): void {
    this.game.with(Player, (p) => {
      this.x = p.x;
      this.y = p.y;
    });
    this.visible = g.SHOW_BARRIERS;
  }
}

// ---- Depth masks (foreground cut-outs of the background) ----

export class MaskBase extends Instance {
  static objName = 'obj_mask_base';
  offset = 0;
  spriteName = '';
  override create(): void {
    if (this.spriteName) this.sprite = getSprite(this.spriteName);
    // Center the object
    this.x = Math.floor(this.game.roomWidth / 2);
    this.y = Math.floor(this.game.roomHeight / 2);
  }
  override step(): void {
    // Adjust depth based on player position
    this.game.with(Player, (p) => {
      if (p.y < this.y + this.offset) this.depth = p.depth - 10;
      else if (p.y > this.y + this.offset) this.depth = p.depth + 10;
    });
  }
}

function mask(objName: string, spriteName: string, offset: number | 'room'): Ctor<MaskBase> {
  const C = class extends MaskBase {
    static objName = objName;
    override create(): void {
      this.spriteName = spriteName;
      this.offset = offset === 'room' ? this.game.roomHeight : offset;
      super.create();
    }
  };
  return C;
}

export const MASKS: Ctor<MaskBase>[] = [
  mask('obj_basement_cave_mask', 'spr_bkg_basement_cave_mask', 50),
  mask('obj_basement_stairs_mask', 'spr_bkg_basement_stairs_mask', 30),
  mask('obj_batcave_cave_mask', 'spr_bkg_batcave_cave_mask', 'room'),
  mask('obj_batcave_mummyroom_cave_mask', 'spr_bkg_batcave_mummyrm_mask', 10),
  mask('obj_batcave_rock_mask', 'spr_bkg_batcave_rock_mask', 65),
  mask('obj_deadend_cave_mask', 'spr_bkg_deadend_cave_mask', 'room'),
  mask('obj_deadend_lower_rock_mask', 'spr_bkg_deadend_rock_lower_mask', 55),
  mask('obj_deadend_upper_rock_mask', 'spr_bkg_deadend_rock_upper_mask', 25),
  mask('obj_diningroom_mask', 'spr_bkg_diningrm_mask', 50),
  mask('obj_garden_mask_shed', 'spr_bkg_garden_shed', -15),
  mask('obj_garden_mask_tree', 'spr_bkg_garden_tree', 30),
  mask('obj_kitchen_mask', 'spr_bkg_kitchen_mask', 50),
  mask('obj_lakeroom_cave_mask', 'spr_bkg_lakeroom_cave_mask', 'room'),
  mask('obj_lakeroom_guardroom_mask', 'spr_bkg_lakeroom_guardroom_mask', 0),
  mask('obj_mummyroom_cave_mask', 'spr_bkg_mummyroom_cave_mask', 'room'),
  mask('obj_mummyroom_coffin_mask', 'spr_bkg_mummyroom_coffin_mask', 20),
  mask('obj_mummyroom_rock_large_mask', 'spr_bkg_mummyroom_rock_large_mask', 30),
  mask('obj_mummyroom_rock_small_mask', 'spr_bkg_mummyroom_rock_small_mask', 45),
];

/** The dining room table mask is referenced by the butler. */
export const DiningroomMask = MASKS[8];

export class HallMask extends MaskBase {
  static objName = 'obj_hall_mask';
  override create(): void {
    this.spriteName = 'spr_bkg_hall_mask';
    super.create();
  }
  override step(): void {
    // Show Hugo behind mask
    this.game.with(Player, (p) => (this.depth = p.depth - 10));
  }
}

// ---- Room transitions ----

export class TransitionBase extends Instance {
  static objName = 'obj_transition_base';
  dst_room: string | undefined = undefined;
  dst_x = 0;
  dst_y = 0;
  dst_direction: string | number = NO_ROOM;
  flag: string | undefined = undefined;
  override create(): void {
    this.visible = false;
    this.depth = -10000;
    this.sprite = DEBUG_SPRITES.spr_debug_yellow;
  }
  override step(): void {
    this.visible = g.SHOW_BARRIERS;
  }
}

function mv(objName: string, room: string, x: number, y: number, dir?: string, flag?: string): Ctor<TransitionBase> {
  return class extends TransitionBase {
    static objName = objName;
    override create(): void {
      super.create();
      this.dst_room = room;
      this.dst_x = x;
      this.dst_y = y;
      if (dir !== undefined) this.dst_direction = dir;
      if (flag !== undefined) this.flag = flag;
    }
  };
}

export const MvHallLab = mv('obj_mv_hhh_hall_lab', 'rm_lab', 46, 168);
export const MvLabHall = mv('obj_mv_hhh_lab_hall', 'rm_hall', 260, 94);

export const TRANSITIONS: Ctor<TransitionBase>[] = [
  mv('obj_mv_hhh_basement_batcave', 'rm_batcave', 285, 150, 'left', 'batcave_enter'),
  mv('obj_mv_hhh_basement_storerm', 'rm_storerm', 255, 145),
  mv('obj_mv_hhh_batcave_basement', 'rm_basement', 141, 138, 'left'),
  mv('obj_mv_hhh_batcave_mummyroom', 'rm_mummyrm', 85, 165),
  mv('obj_mv_hhh_bathoom_hall', 'rm_hall', 221, 92),
  mv('obj_mv_hhh_bedroom_hall', 'rm_hall', 139, 94),
  mv('obj_mv_hhh_deadend_jail', 'rm_jail', 155, 155),
  mv('obj_mv_hhh_deadend_lakeroom', 'rm_lakeroom', 290, 65, 'left'),
  mv('obj_mv_hhh_diningroom_hall', 'rm_hall', 270, 165),
  mv('obj_mv_hhh_diningroom_kitchen', 'rm_kitchen', 252, 136),
  mv('obj_mv_hhh_garden_kitchen', 'rm_kitchen', 227, 140),
  mv('obj_mv_hhh_hall_bathroom', 'rm_bathroom', 144, 154),
  mv('obj_mv_hhh_hall_bedroom', 'rm_bedroom', 175, 125),
  mv('obj_mv_hhh_hall_diningroom', 'rm_diningrm', 32, 152),
  mv('obj_mv_hhh_hall_house', 'rm_house', 40, 185),
  mv('obj_mv_hhh_hall_kitchen', 'rm_kitchen', 254, 160),
  MvHallLab,
  mv('obj_mv_hhh_house_hall', 'rm_hall', 120, 172, undefined, 'enter_house'),
  mv('obj_mv_hhh_kitchen_diningroom', 'rm_diningrm', 82, 121),
  mv('obj_mv_hhh_kitchen_garden', 'rm_garden', 264, 174),
  mv('obj_mv_hhh_kitchen_hall', 'rm_hall', 225, 164),
  mv('obj_mv_hhh_kitchen_storerm', 'rm_storerm', 255, 145),
  MvLabHall,
  mv('obj_mv_hhh_lakeroom_deadend', 'rm_deadend', 160, 170, 'up'),
  mv('obj_mv_hhh_lakeroom_mummyroom', 'rm_mummyrm', 270, 120, 'down'),
  mv('obj_mv_hhh_mummyroom_batcave', 'rm_batcave', 115, 110),
  mv('obj_mv_hhh_mummyroom_lakeroom', 'rm_lakeroom', 65, 175),
  mv('obj_mv_hhh_storerm_basement', 'rm_basement', 85, 85),
  mv('obj_mv_hhh_storerm_kitchen', 'rm_kitchen', 59, 143),
];

// ---- Hugo ----

export class Player extends StateBase {
  static objName = 'obj_player';
  move_x = 0;
  move_y = 0;

  override create(): void {
    this.sprite = getSprite('spr_hugo_down');
    // Do not walk initially
    this.imageSpeed = 0;
  }

  /** True while Hugo is walking (used by the touch UI's stop button). */
  get moving(): boolean {
    return this.move_x !== 0 || this.move_y !== 0;
  }

  override keyPress(key: number): void {
    switch (key) {
      case VK.left:
      case VK.numpad4:
        this.walk(-1, 0, 'left');
        break;
      case VK.up:
      case VK.numpad8:
        this.walk(0, -1, 'up');
        break;
      case VK.right:
      case VK.numpad6:
        this.walk(1, 0, 'right');
        break;
      case VK.down:
      case VK.numpad2:
        this.walk(0, 1, 'down');
        break;
    }
  }

  /** Arrow key handling: press once to start walking, again to stop. */
  private walk(dx: number, dy: number, dir: string): void {
    if (g.game_state.dead) return;
    this.sprite = getSprite('spr_hugo_' + g.game_state.status + dir);
    if (dx !== 0) {
      this.move_y = 0;
      if (this.move_x !== dx) {
        this.move_x = dx;
        this.imageSpeed = 1;
      } else {
        this.move_x = 0;
        this.imageSpeed = 0;
      }
    } else {
      this.move_x = 0;
      if (this.move_y !== dy) {
        this.move_y = dy;
        this.imageSpeed = 1;
      } else {
        this.move_y = 0;
        this.imageSpeed = 0;
      }
    }
  }

  override beginStep(): void {
    // Manage large hitbox object
    if (this.game.count(PlayerHitboxLarge) === 0) this.game.instanceCreate(PlayerHitboxLarge, this.x, this.y, this.depth);
  }

  override step(): void {
    const game = this.game;
    // "Kill" the player once they reach the end
    if (game.room === 'rm_jail') {
      setStatus(STATUS_WON);
      g.game_state.dead = true;
    }

    if (g.game_state.dead) {
      const st = g.game_state.status;
      if (st === STATUS_HEADLESS && this.sprite !== getSprite('spr_hugo_headless')) this.sprite = getSprite('spr_hugo_headless');
      else if (st === STATUS_DEAD && this.sprite !== getSprite('spr_hugo_dead')) this.sprite = getSprite('spr_hugo_dead');
      else if (st === STATUS_WON && this.sprite !== getSprite('spr_hugo_dizzy_right')) {
        this.sprite = getSprite('spr_hugo_dizzy_right');
        this.imageSpeed = 0.8;
      }
      return;
    }

    // Handle horizontal movement
    if (this.move_x !== 0) {
      const dst = this.move_x < 0 ? Math.floor(this.move_x * MOVESPEED) : Math.ceil(this.move_x * MOVESPEED);
      if (
        !game.placeMeeting(this, this.x + dst, this.y, BarrierBase) &&
        !game.placeMeeting(this, this.x + dst, this.y, InteractSolidBase) &&
        this.x + dst > 0 &&
        this.x + dst < game.roomWidth
      )
        this.x += dst;
      else {
        this.move_x = 0;
        this.imageSpeed = 0;
      }
    }

    // Handle vertical movement
    if (this.move_y !== 0) {
      const dst = this.move_y < 0 ? Math.floor(this.move_y * MOVESPEED) : Math.ceil(this.move_y * MOVESPEED);
      const h = this.bboxHeight;
      if (
        !game.placeMeeting(this, this.x, this.y + dst, BarrierBase) &&
        !game.placeMeeting(this, this.x, this.y + dst, InteractSolidBase) &&
        this.y + dst > 0 + h &&
        this.y + dst < game.roomHeight - h
      )
        this.y += dst;
      else {
        this.move_y = 0;
        this.imageSpeed = 0;
      }
    }
  }

  override collisionEvents(): [Ctor, (o: any) => void][] {
    return [
      [BarrierBase, () => this.stopMoving()],
      [TransitionBase, (o: TransitionBase) => this.onTransition(o)],
    ];
  }

  stopMoving(): void {
    this.move_x = 0;
    this.move_y = 0;
    this.imageSpeed = 0;
  }

  private onTransition(other: TransitionBase): void {
    if (other.dst_room === undefined) return;
    const game = this.game;
    const room = game.room;
    let ok = true;
    if (other.dst_room === 'rm_hall' && room === 'rm_lab') {
      let msg = '';
      const st = g.game_state.status;
      if (st === STATUS_DIZZY) msg = 'In your current state, you cannot move your hand to the doorknob to leave!';
      else if (st === STATUS_STATIC) msg = 'In your current state, your hand passes right through the doorknob!';
      else if (st === STATUS_MINI) msg = 'In your current state, you cannot wrap your tiny hand around the doorknob!';
      if (msg !== '') {
        ok = false;
        // Move the player to just beside the transition object
        this.x = other.x + (other.sprite ? other.sprite.width : 0);
        showMessage(msg, room);
      }
    }

    // Do not let the player go to the basement until the carpet and trapdoor are cleared
    if (other.dst_room === 'rm_basement' && room === 'rm_storerm') {
      if (game.exists(game.objectByName('obj_trapdoor')!)) ok = false;
      if (game.exists(game.objectByName('obj_carpet')!)) ok = false;
    }

    // Make the player mini if they're going into the lake room, normal when leaving it
    if (other.dst_room === 'rm_lakeroom') setStatus(STATUS_MINI);
    else if (room === 'rm_lakeroom') setStatus(STATUS_NORMAL);

    if (!ok) return;
    // Close any auto-close doors if they exist
    game.with(DoorAutoclose, (d) => {
      d.attrs.opened = false;
      d.imageSpeed = 0;
    });
    if (other.flag !== undefined) setFlag(other.flag);

    // If we are going to the lab specifically, remove the mask from our inventory
    let msg = '';
    if (other.dst_room === 'rm_lab' && inventoryHas('mask')) {
      msg = 'The radiation emanating from the room blasts your mask onto the floor!\n(You can pick it back up once you leave)';
      inventoryRemove('mask');
      setStatus(STATUS_NORMAL);
      game.instanceCreate(game.objectByName('obj_mask')!, this.x - 20, this.y, this.depth);
    }

    saveRoomState(room);
    roomTransition(other.dst_room, other.dst_x, other.dst_y, other.dst_direction, msg);
  }
}
