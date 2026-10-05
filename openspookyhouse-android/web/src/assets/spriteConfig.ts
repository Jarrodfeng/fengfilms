// Port of scripts/_define_sprites: which frames of the original game files
// make up each OpenSpookyHouse sprite, plus origins, bounding boxes,
// animation speeds and depth masks. Converted mechanically from the GML.

export interface SpriteConfig {
  dat: "OBJECTS.DAT" | "SCENERY.DAT";
  dat_frames: number[];
  file: string;
  file_frames: number[];
  speed?: number;
  /** [left, right, top, bottom] */
  bbox?: [number, number, number, number];
  origin?: [number, number];
  align?: "left" | "right";
  mask?: { mask: string; name: string }[];
}

export const SPRITE_CONFIG: Record<string, SpriteConfig> = {
  "spr_arc": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      178,
      179
    ],
    "file": "ARC.PIX",
    "file_frames": [
      0,
      1
    ],
    "speed": 5
  },
  "spr_arm": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      72,
      73
    ],
    "file": "ARM.PIX",
    "file_frames": [
      0,
      1
    ],
    "speed": 2
  },
  "spr_bat": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      18
    ],
    "file": "BAT.PIX",
    "file_frames": [
      0
    ]
  },
  "spr_boat_empty": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      114
    ],
    "file": "BOAT.PIX",
    "file_frames": [
      0
    ]
  },
  "spr_boat_full": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      115
    ],
    "file": "BOAT.PIX",
    "file_frames": [
      1
    ]
  },
  "spr_bung": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      152
    ],
    "file": "BUNG.PIX",
    "file_frames": [
      0
    ]
  },
  "spr_butler_right": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      56,
      57,
      58,
      59
    ],
    "file": "BUTLER.PIX",
    "file_frames": [
      0,
      1,
      2,
      3
    ],
    "bbox": [
      7,
      16,
      35,
      45
    ],
    "origin": [
      12,
      39
    ]
  },
  "spr_butler_left": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      60,
      61,
      62,
      63
    ],
    "file": "BUTLER.PIX",
    "file_frames": [
      4,
      5,
      6,
      7
    ],
    "bbox": [
      7,
      16,
      35,
      45
    ],
    "origin": [
      12,
      39
    ]
  },
  "spr_butler_down": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      64,
      65
    ],
    "file": "BUTLER.PIX",
    "file_frames": [
      8,
      9
    ],
    "bbox": [
      7,
      16,
      35,
      45
    ],
    "origin": [
      12,
      39
    ]
  },
  "spr_butler_up": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      66,
      67
    ],
    "file": "BUTLER.PIX",
    "file_frames": [
      10,
      11
    ],
    "bbox": [
      7,
      16,
      35,
      45
    ],
    "origin": [
      12,
      39
    ]
  },
  "spr_hugo_butler_right": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      56,
      57,
      58,
      59
    ],
    "file": "BUTLER.PIX",
    "file_frames": [
      0,
      1,
      2,
      3
    ],
    "bbox": [
      7,
      16,
      35,
      45
    ],
    "origin": [
      12,
      39
    ]
  },
  "spr_hugo_butler_left": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      60,
      61,
      62,
      63
    ],
    "file": "BUTLER.PIX",
    "file_frames": [
      4,
      5,
      6,
      7
    ],
    "bbox": [
      7,
      16,
      35,
      45
    ],
    "origin": [
      12,
      39
    ]
  },
  "spr_hugo_butler_down": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      64,
      65
    ],
    "file": "BUTLER.PIX",
    "file_frames": [
      8,
      9
    ],
    "bbox": [
      7,
      16,
      35,
      45
    ],
    "origin": [
      12,
      39
    ]
  },
  "spr_hugo_butler_up": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      66,
      67
    ],
    "file": "BUTLER.PIX",
    "file_frames": [
      10,
      11
    ],
    "bbox": [
      7,
      16,
      35,
      45
    ],
    "origin": [
      12,
      39
    ]
  },
  "spr_candle": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      31,
      32
    ],
    "file": "CANDLE.PIX",
    "file_frames": [
      0,
      1
    ],
    "speed": 5
  },
  "spr_carpet": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      87
    ],
    "file": "CARPET.PIX",
    "file_frames": [
      0
    ]
  },
  "spr_chop": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      68
    ],
    "file": "CHOP.PIX",
    "file_frames": [
      0
    ]
  },
  "spr_dog_walk_right": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      79,
      80,
      81
    ],
    "file": "DOG.PIX",
    "file_frames": [
      0,
      1,
      2
    ],
    "bbox": [
      5,
      24,
      13,
      29
    ],
    "origin": [
      17,
      28
    ],
    "speed": 7
  },
  "spr_dog_walk_left": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      82,
      83,
      84
    ],
    "file": "DOG.PIX",
    "file_frames": [
      3,
      4,
      5
    ],
    "bbox": [
      5,
      24,
      13,
      29
    ],
    "origin": [
      17,
      28
    ],
    "speed": 7
  },
  "spr_dog_sit_right": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      85
    ],
    "file": "DOG.PIX",
    "file_frames": [
      6
    ],
    "bbox": [
      5,
      24,
      13,
      29
    ],
    "origin": [
      17,
      28
    ]
  },
  "spr_dog_sit_left": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      86
    ],
    "file": "DOG.PIX",
    "file_frames": [
      7
    ],
    "bbox": [
      5,
      24,
      13,
      29
    ],
    "origin": [
      17,
      28
    ]
  },
  "spr_door": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      12,
      13,
      14,
      15,
      15
    ],
    "file": "DOOR.PIX",
    "file_frames": [
      0,
      1,
      2,
      3,
      3
    ],
    "bbox": [
      0,
      25,
      0,
      36
    ],
    "align": "left",
    "speed": 2
  },
  "spr_hall_door": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      12,
      13,
      14,
      15,
      15
    ],
    "file": "DOOR.PIX",
    "file_frames": [
      0,
      1,
      2,
      3,
      3
    ],
    "bbox": [
      0,
      25,
      0,
      32
    ],
    "align": "left",
    "speed": 2
  },
  "spr_eyes": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      16
    ],
    "file": "EYES.PIX",
    "file_frames": [
      0
    ]
  },
  "spr_hugo_static_down": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      174,
      175
    ],
    "file": "FUZYHERO.PIX",
    "file_frames": [
      8,
      9
    ],
    "bbox": [
      7,
      16,
      35,
      45
    ],
    "origin": [
      12,
      39
    ]
  },
  "spr_hugo_static_up": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      176,
      177
    ],
    "file": "FUZYHERO.PIX",
    "file_frames": [
      10,
      11
    ],
    "bbox": [
      7,
      16,
      35,
      45
    ],
    "origin": [
      12,
      39
    ]
  },
  "spr_hugo_static_left": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      170,
      171,
      172,
      173
    ],
    "file": "FUZYHERO.PIX",
    "file_frames": [
      4,
      5,
      6,
      7
    ],
    "bbox": [
      7,
      16,
      35,
      45
    ],
    "origin": [
      12,
      39
    ]
  },
  "spr_hugo_static_right": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      166,
      167,
      168,
      169
    ],
    "file": "FUZYHERO.PIX",
    "file_frames": [
      0,
      1,
      2,
      3
    ],
    "bbox": [
      7,
      16,
      35,
      45
    ],
    "origin": [
      12,
      39
    ]
  },
  "spr_glassdoor": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      153
    ],
    "file": "GLASDOOR.PIX",
    "file_frames": [
      0
    ],
    "bbox": [
      0,
      43,
      55,
      57
    ],
    "origin": [
      25,
      56
    ]
  },
  "spr_gold": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      113
    ],
    "file": "GOLD.PIX",
    "file_frames": [
      0
    ]
  },
  "spr_guard_down": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      131
    ],
    "file": "GUARD.PIX",
    "file_frames": [
      0
    ],
    "bbox": [
      0,
      24,
      35,
      45
    ],
    "origin": [
      12,
      39
    ]
  },
  "spr_guard_left": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      132,
      133,
      134,
      135
    ],
    "file": "GUARD.PIX",
    "file_frames": [
      1,
      2,
      3,
      4
    ],
    "bbox": [
      0,
      24,
      35,
      45
    ],
    "origin": [
      12,
      39
    ],
    "speed": 5
  },
  "spr_hugo_headless": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      74
    ],
    "file": "HDLSHERO.PIX",
    "file_frames": [
      0
    ],
    "bbox": [
      7,
      16,
      35,
      45
    ],
    "origin": [
      12,
      39
    ]
  },
  "spr_hugo_down": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      8,
      9
    ],
    "file": "HERO.PIX",
    "file_frames": [
      8,
      9
    ],
    "bbox": [
      7,
      16,
      35,
      45
    ],
    "origin": [
      12,
      39
    ]
  },
  "spr_hugo_up": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      10,
      11
    ],
    "file": "HERO.PIX",
    "file_frames": [
      10,
      11
    ],
    "bbox": [
      7,
      16,
      35,
      45
    ],
    "origin": [
      12,
      39
    ]
  },
  "spr_hugo_left": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      4,
      5,
      6,
      7
    ],
    "file": "HERO.PIX",
    "file_frames": [
      4,
      5,
      6,
      7
    ],
    "bbox": [
      7,
      16,
      35,
      45
    ],
    "origin": [
      12,
      39
    ]
  },
  "spr_hugo_right": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      0,
      1,
      2,
      3
    ],
    "file": "HERO.PIX",
    "file_frames": [
      0,
      1,
      2,
      3
    ],
    "bbox": [
      7,
      16,
      35,
      45
    ],
    "origin": [
      12,
      39
    ]
  },
  "spr_hugo_dead": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      92
    ],
    "file": "HERODEAD.PIX",
    "file_frames": [
      0
    ],
    "bbox": [
      7,
      16,
      35,
      45
    ],
    "origin": [
      12,
      39
    ]
  },
  "spr_igor_right": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      144,
      145,
      146,
      147
    ],
    "file": "IGOR.PIX",
    "file_frames": [
      0,
      1,
      2,
      3
    ],
    "bbox": [
      0,
      24,
      35,
      45
    ],
    "origin": [
      12,
      39
    ]
  },
  "spr_igor_left": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      148,
      149,
      150,
      151
    ],
    "file": "IGOR.PIX",
    "file_frames": [
      4,
      5,
      6,
      7
    ],
    "bbox": [
      0,
      24,
      35,
      45
    ],
    "origin": [
      12,
      39
    ]
  },
  "spr_key": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      20
    ],
    "file": "KEY.PIX",
    "file_frames": [
      0
    ]
  },
  "spr_lips": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      70,
      71
    ],
    "file": "LIPS.PIX",
    "file_frames": [
      0,
      1
    ],
    "speed": 5
  },
  "spr_mask": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      43
    ],
    "file": "MASK.PIX",
    "file_frames": [
      0
    ]
  },
  "spr_mummy_door": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      109,
      110,
      111,
      112,
      112
    ],
    "file": "MDOOR.PIX",
    "file_frames": [
      0,
      1,
      2,
      3,
      3
    ],
    "speed": 2,
    "align": "right"
  },
  "spr_hugo_mask_down": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      52,
      53
    ],
    "file": "MONKEY.PIX",
    "file_frames": [
      8,
      9
    ],
    "bbox": [
      7,
      16,
      35,
      45
    ],
    "origin": [
      12,
      39
    ]
  },
  "spr_hugo_mask_up": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      54,
      55
    ],
    "file": "MONKEY.PIX",
    "file_frames": [
      10,
      11
    ],
    "bbox": [
      7,
      16,
      35,
      45
    ],
    "origin": [
      12,
      39
    ]
  },
  "spr_hugo_mask_left": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      48,
      49,
      50,
      51
    ],
    "file": "MONKEY.PIX",
    "file_frames": [
      4,
      5,
      6,
      7
    ],
    "bbox": [
      7,
      16,
      35,
      45
    ],
    "origin": [
      12,
      39
    ]
  },
  "spr_hugo_mask_right": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      44,
      45,
      46,
      47
    ],
    "file": "MONKEY.PIX",
    "file_frames": [
      0,
      1,
      2,
      3
    ],
    "bbox": [
      7,
      16,
      35,
      45
    ],
    "origin": [
      12,
      39
    ]
  },
  "spr_mummy_right": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      97,
      98,
      99,
      100
    ],
    "file": "MUMMY.PIX",
    "file_frames": [
      0,
      1,
      2,
      3
    ],
    "bbox": [
      7,
      16,
      35,
      45
    ],
    "origin": [
      12,
      39
    ],
    "speed": 15
  },
  "spr_mummy_left": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      101,
      102,
      103,
      104
    ],
    "file": "MUMMY.PIX",
    "file_frames": [
      4,
      5,
      6,
      7
    ],
    "bbox": [
      7,
      16,
      35,
      45
    ],
    "origin": [
      12,
      39
    ],
    "speed": 15
  },
  "spr_mummy_down": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      105,
      106
    ],
    "file": "MUMMY.PIX",
    "file_frames": [
      8,
      9
    ],
    "bbox": [
      7,
      16,
      35,
      45
    ],
    "origin": [
      12,
      39
    ],
    "speed": 15
  },
  "spr_mummy_up": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      107,
      108
    ],
    "file": "MUMMY.PIX",
    "file_frames": [
      10,
      11
    ],
    "bbox": [
      7,
      16,
      35,
      45
    ],
    "origin": [
      12,
      39
    ],
    "speed": 15
  },
  "spr_hugo_mummy_right": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      97,
      98,
      99,
      100
    ],
    "file": "MUMMY.PIX",
    "file_frames": [
      0,
      1,
      2,
      3
    ],
    "bbox": [
      7,
      16,
      35,
      45
    ],
    "origin": [
      12,
      39
    ]
  },
  "spr_hugo_mummy_left": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      101,
      102,
      103,
      104
    ],
    "file": "MUMMY.PIX",
    "file_frames": [
      4,
      5,
      6,
      7
    ],
    "bbox": [
      7,
      16,
      35,
      45
    ],
    "origin": [
      12,
      39
    ]
  },
  "spr_hugo_mummy_down": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      105,
      106
    ],
    "file": "MUMMY.PIX",
    "file_frames": [
      8,
      9
    ],
    "bbox": [
      7,
      16,
      35,
      45
    ],
    "origin": [
      12,
      39
    ]
  },
  "spr_hugo_mummy_up": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      107,
      108
    ],
    "file": "MUMMY.PIX",
    "file_frames": [
      10,
      11
    ],
    "bbox": [
      7,
      16,
      35,
      45
    ],
    "origin": [
      12,
      39
    ]
  },
  "spr_old_man": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      118
    ],
    "file": "OLDMAN.PIX",
    "file_frames": [
      0
    ]
  },
  "spr_prof_right": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      136,
      137,
      138,
      139
    ],
    "file": "PROF.PIX",
    "file_frames": [
      0,
      1,
      2,
      3
    ],
    "bbox": [
      7,
      16,
      35,
      45
    ],
    "origin": [
      12,
      39
    ]
  },
  "spr_prof_left": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      140,
      141,
      142,
      143
    ],
    "file": "PROF.PIX",
    "file_frames": [
      4,
      5,
      6,
      7
    ],
    "bbox": [
      7,
      16,
      35,
      45
    ],
    "origin": [
      12,
      39
    ]
  },
  "spr_pumpkin": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      19
    ],
    "file": "PUMPKIN.PIX",
    "file_frames": [
      0
    ]
  },
  "spr_red_eyes": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      69
    ],
    "file": "REDEYES.PIX",
    "file_frames": [
      0
    ]
  },
  "spr_rope_tether": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      116
    ],
    "file": "ROPE.PIX",
    "file_frames": [
      0
    ]
  },
  "spr_rope_cut": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      117
    ],
    "file": "ROPE.PIX",
    "file_frames": [
      1
    ]
  },
  "spr_hugo_dizzy_right": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      154,
      155,
      156,
      157
    ],
    "file": "SPACHERO.PIX",
    "file_frames": [
      0,
      1,
      2,
      3
    ],
    "bbox": [
      7,
      16,
      35,
      45
    ],
    "origin": [
      12,
      39
    ]
  },
  "spr_hugo_dizzy_left": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      158,
      159,
      160,
      161
    ],
    "file": "SPACHERO.PIX",
    "file_frames": [
      4,
      5,
      6,
      7
    ],
    "bbox": [
      7,
      16,
      35,
      45
    ],
    "origin": [
      12,
      39
    ]
  },
  "spr_hugo_dizzy_down": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      162,
      163
    ],
    "file": "SPACHERO.PIX",
    "file_frames": [
      8,
      9
    ],
    "bbox": [
      7,
      16,
      35,
      45
    ],
    "origin": [
      12,
      39
    ]
  },
  "spr_hugo_dizzy_up": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      164,
      165
    ],
    "file": "SPACHERO.PIX",
    "file_frames": [
      10,
      11
    ],
    "bbox": [
      7,
      16,
      35,
      45
    ],
    "origin": [
      12,
      39
    ]
  },
  "spr_trap_door": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      88
    ],
    "file": "TRAP.PIX",
    "file_frames": [
      0
    ]
  },
  "spr_wardrobe_door_left": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      35,
      36,
      37,
      38,
      38
    ],
    "file": "WDOORL.PIX",
    "file_frames": [
      0,
      1,
      2,
      3,
      3
    ],
    "bbox": [
      0,
      25,
      0,
      52
    ],
    "align": "left",
    "speed": 2
  },
  "spr_wardrobe_door_right": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      39,
      40,
      41,
      42,
      42
    ],
    "file": "WDOORR.PIX",
    "file_frames": [
      0,
      1,
      2,
      3,
      3
    ],
    "bbox": [
      0,
      25,
      0,
      52
    ],
    "align": "right",
    "speed": 2
  },
  "spr_hugo_mini_right": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      119,
      120,
      121,
      122
    ],
    "file": "WHERO.PIX",
    "file_frames": [
      0,
      1,
      2,
      3
    ],
    "bbox": [
      3,
      12,
      23,
      29
    ],
    "origin": [
      9,
      27
    ]
  },
  "spr_hugo_mini_left": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      123,
      124,
      125,
      126
    ],
    "file": "WHERO.PIX",
    "file_frames": [
      4,
      5,
      6,
      7
    ],
    "bbox": [
      3,
      12,
      23,
      29
    ],
    "origin": [
      9,
      27
    ]
  },
  "spr_hugo_mini_down": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      127,
      128
    ],
    "file": "WHERO.PIX",
    "file_frames": [
      8,
      9
    ],
    "bbox": [
      3,
      12,
      23,
      29
    ],
    "origin": [
      9,
      27
    ]
  },
  "spr_hugo_mini_up": {
    "dat": "OBJECTS.DAT",
    "dat_frames": [
      129,
      130
    ],
    "file": "WHERO.PIX",
    "file_frames": [
      10,
      11
    ],
    "bbox": [
      3,
      12,
      23,
      29
    ],
    "origin": [
      9,
      27
    ]
  },
  "spr_bkg_basement": {
    "dat": "SCENERY.DAT",
    "dat_frames": [
      8
    ],
    "file": "BASEMENT.ART",
    "file_frames": [
      0
    ],
    "mask": [
      {
        "mask": "spr_mask_basement_stairs",
        "name": "spr_bkg_basement_stairs_mask"
      },
      {
        "mask": "spr_mask_basement_cave",
        "name": "spr_bkg_basement_cave_mask"
      }
    ]
  },
  "spr_bkg_batcave": {
    "dat": "SCENERY.DAT",
    "dat_frames": [
      9
    ],
    "file": "BATCAVE.ART",
    "file_frames": [
      0
    ],
    "mask": [
      {
        "mask": "spr_mask_batcave_rock",
        "name": "spr_bkg_batcave_rock_mask"
      },
      {
        "mask": "spr_mask_batcave_cave",
        "name": "spr_bkg_batcave_cave_mask"
      },
      {
        "mask": "spr_mask_batcave_mummyrm_entrance",
        "name": "spr_bkg_batcave_mummyrm_mask"
      }
    ]
  },
  "spr_bkg_bathroom": {
    "dat": "SCENERY.DAT",
    "dat_frames": [
      4
    ],
    "file": "BATHROOM.ART",
    "file_frames": [
      0
    ]
  },
  "spr_bkg_bed1": {
    "dat": "SCENERY.DAT",
    "dat_frames": [
      2
    ],
    "file": "BED1.ART",
    "file_frames": [
      0
    ]
  },
  "spr_bkg_deadend": {
    "dat": "SCENERY.DAT",
    "dat_frames": [
      12
    ],
    "file": "DEADEND.ART",
    "file_frames": [
      0
    ],
    "mask": [
      {
        "mask": "spr_mask_deadend_cave",
        "name": "spr_bkg_deadend_cave_mask"
      },
      {
        "mask": "spr_mask_deadend_rock_lower",
        "name": "spr_bkg_deadend_rock_lower_mask"
      },
      {
        "mask": "spr_mask_deadend_rock_upper",
        "name": "spr_bkg_deadend_rock_upper_mask"
      }
    ]
  },
  "spr_bkg_diningrm": {
    "dat": "SCENERY.DAT",
    "dat_frames": [
      3
    ],
    "file": "DININGRM.ART",
    "file_frames": [
      0
    ],
    "mask": [
      {
        "mask": "spr_mask_diningroom",
        "name": "spr_bkg_diningrm_mask"
      }
    ]
  },
  "spr_bkg_garden": {
    "dat": "SCENERY.DAT",
    "dat_frames": [
      6
    ],
    "file": "GARDEN.ART",
    "file_frames": [
      0
    ],
    "mask": [
      {
        "mask": "spr_mask_garden_tree",
        "name": "spr_bkg_garden_tree"
      },
      {
        "mask": "spr_mask_garden_shed",
        "name": "spr_bkg_garden_shed"
      }
    ]
  },
  "spr_bkg_hall": {
    "dat": "SCENERY.DAT",
    "dat_frames": [
      1
    ],
    "file": "HALL.ART",
    "file_frames": [
      0
    ],
    "mask": [
      {
        "mask": "spr_mask_hall",
        "name": "spr_bkg_hall_mask"
      }
    ]
  },
  "spr_bkg_house": {
    "dat": "SCENERY.DAT",
    "dat_frames": [
      0
    ],
    "file": "HOUSE.ART",
    "file_frames": [
      0
    ]
  },
  "spr_bkg_jail": {
    "dat": "SCENERY.DAT",
    "dat_frames": [
      13
    ],
    "file": "JAIL.ART",
    "file_frames": [
      0
    ]
  },
  "spr_bkg_kitchen": {
    "dat": "SCENERY.DAT",
    "dat_frames": [
      5
    ],
    "file": "KITCHEN.ART",
    "file_frames": [
      0
    ],
    "mask": [
      {
        "mask": "spr_mask_kitchen",
        "name": "spr_bkg_kitchen_mask"
      }
    ]
  },
  "spr_bkg_lab": {
    "dat": "SCENERY.DAT",
    "dat_frames": [
      15
    ],
    "file": "LAB.ART",
    "file_frames": [
      0
    ]
  },
  "spr_bkg_lakeroom": {
    "dat": "SCENERY.DAT",
    "dat_frames": [
      11
    ],
    "file": "LAKEROOM.ART",
    "file_frames": [
      0
    ],
    "mask": [
      {
        "mask": "spr_mask_lakeroom_cave",
        "name": "spr_bkg_lakeroom_cave_mask"
      },
      {
        "mask": "spr_mask_lakeroom_guardroom",
        "name": "spr_bkg_lakeroom_guardroom_mask"
      }
    ]
  },
  "spr_bkg_mummy_room": {
    "dat": "SCENERY.DAT",
    "dat_frames": [
      10
    ],
    "file": "MUMMYRM.ART",
    "file_frames": [
      0
    ],
    "mask": [
      {
        "mask": "spr_mask_mummyroom_cave",
        "name": "spr_bkg_mummyroom_cave_mask"
      },
      {
        "mask": "spr_mask_mummyroom_coffin",
        "name": "spr_bkg_mummyroom_coffin_mask"
      },
      {
        "mask": "spr_mask_mummyroom_rock_large",
        "name": "spr_bkg_mummyroom_rock_large_mask"
      },
      {
        "mask": "spr_mask_mummyroom_rock_small",
        "name": "spr_bkg_mummyroom_rock_small_mask"
      }
    ]
  },
  "spr_bkg_storerm": {
    "dat": "SCENERY.DAT",
    "dat_frames": [
      7
    ],
    "file": "STORERM.ART",
    "file_frames": [
      0
    ]
  },
  "spr_bkg_theend": {
    "dat": "SCENERY.DAT",
    "dat_frames": [
      14
    ],
    "file": "THE_END.ART",
    "file_frames": [
      0
    ]
  }
};
