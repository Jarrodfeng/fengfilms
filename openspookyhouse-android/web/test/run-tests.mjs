// End-to-end tests in headless Chromium, using synthetic placeholder game
// files (see fixtures.ts). Run `npm run build` first.
//
//   node test/run-tests.mjs [--shots <dir>]
//
// 1. Imports the synthetic OBJECTS.DAT / SCENERY.DAT through the real importer.
// 2. Plays the whole game through to the ending (every scored puzzle) and
//    checks the score reaches the maximum.
// 3. Exercises save / restore, options, help, quit, death and autosave.
// 4. Connects a receiver page as a "TV" and checks it shows the same picture.
import { chromium } from 'playwright-core';
import * as esbuild from 'esbuild';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dist = path.join(root, 'dist');
const shotsArg = process.argv.indexOf('--shots');
const shots = shotsArg > 0 ? process.argv[shotsArg + 1] : null;
if (shots) fs.mkdirSync(shots, { recursive: true });

// ---- Fixtures ----
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'osh-test-'));
await esbuild.build({
  entryPoints: [path.join(root, 'test/fixtures.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: path.join(tmp, 'fixtures.mjs'),
  logLevel: 'warning',
});
const { makeDatFiles } = await import(path.join(tmp, 'fixtures.mjs'));
const fixtures = Object.fromEntries(Object.entries(makeDatFiles()).map(([k, v]) => [k, Buffer.from(v).toString('base64')]));

// ---- Static server ----
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let file = path.join(dist, decodeURIComponent(url.pathname));
  if (file.endsWith('/')) file += 'index.html';
  if (!file.startsWith(dist) || !fs.existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const executablePath = fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined;
const browser = await chromium.launch({ executablePath, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });

let failures = 0;
let checks = 0;
function check(cond, label) {
  checks++;
  if (cond) console.log('  ✓', label);
  else {
    failures++;
    console.log('  ✗', label);
  }
}

// Oppo Find X8 Ultra: 1440 x 3168 px, ~3.5 device pixel ratio
const PHONE = { viewport: { width: 412, height: 905 }, deviceScaleFactor: 3.5, isMobile: true, hasTouch: true };

async function openApp(context) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(base + '/app/index.html');
  await page.waitForFunction(() => window.__oshTest && document.getElementById('titleButtons').children.length > 0);
  return { page, errors };
}

async function importFixtures(page) {
  return page.evaluate(async (files) => {
    const map = new Map(Object.entries(files).map(([k, b64]) => [k, Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))]));
    return window.__oshTest.useFiles(map);
  }, fixtures);
}

function helpers(page) {
  const h = {
    run: (n) => page.evaluate((n) => window.__oshTest.run(n), n),
    room: () => page.evaluate(() => window.__oshTest.session.game.room),
    msg: () => page.evaluate(() => window.__oshTest.g.msg_string),
    score: () => page.evaluate(() => window.__oshTest.g.game_state.score),
    status: () => page.evaluate(() => window.__oshTest.g.game_state.status),
    inv: () => page.evaluate(() => Object.keys(window.__oshTest.g.game_state.inventory)),
    key: async (vk, ticks = 3) => {
      await page.evaluate((vk) => window.__oshTest.session.pressKey(vk), vk);
      return h.run(ticks);
    },
    say: async (text) => {
      await page.evaluate((t) => {
        window.__oshTest.session.setText(t);
        window.__oshTest.session.pressKey(13);
      }, text);
      return h.run(3);
    },
    /** Closes every page of the current message. Returns the texts seen. */
    close: async () => {
      const seen = [];
      for (let i = 0; i < 20; i++) {
        const ui = await h.run(0);
        if (ui.mode === 'play' || ui.mode === 'ended') break;
        seen.push(await h.msg());
        await h.key(13);
      }
      await h.run(2);
      return seen;
    },
    teleport: (x, y) =>
      page.evaluate(
        ([x, y]) => {
          const p = window.__oshTest.session.game.instances.find((i) => i.objName === 'obj_player' && !i.destroyed);
          if (!p) return false;
          p.x = p.xprevious = x;
          p.y = p.yprevious = y;
          p.move_x = p.move_y = 0;
          return true;
        },
        [x, y],
      ),
    obj: (name, expr) =>
      page.evaluate(
        ([name, expr]) => {
          const o = window.__oshTest.session.game.instances.find((i) => i.objName === name && !i.destroyed);
          return o ? new Function('o', 'return ' + expr)(o) : null;
        },
        [name, expr],
      ),
    exists: (name) => page.evaluate((name) => window.__oshTest.session.game.instances.some((i) => i.objName === name && !i.destroyed), name),
    /** Moves Hugo onto a room exit and lets the transition happen. */
    go: async (x, y) => {
      await h.teleport(x, y);
      await h.run(4);
      return h.room();
    },
    shot: async (name) => {
      if (shots) await page.screenshot({ path: path.join(shots, name + '.png') });
    },
  };
  return h;
}

// ===========================================================================
console.log('Import');
const context = await browser.newContext(PHONE);
const { page, errors } = await openApp(context);
const h = helpers(page);
await h.shot('01-import-screen');
check(await importFixtures(page), 'synthetic GOG files are accepted');
const atlas = await page.evaluate(() => ({ sprites: window.__oshTest.assets.meta.sprites.length, warnings: window.__oshTest.assets.warnings, w: window.__oshTest.assets.atlas.width, hgt: window.__oshTest.assets.atlas.height }));
check(atlas.sprites === 109, `all 90 sprites + 19 depth masks built (${atlas.sprites})`);
check(atlas.warnings.length === 0, 'no sprite warnings ' + atlas.warnings.join('; '));
console.log(`  atlas ${atlas.w}x${atlas.hgt}`);

// ===========================================================================
console.log('Full playthrough');
await page.evaluate(() => window.__oshTest.startGame(null));
let ui = await h.run(5);
check((await h.room()) === 'rm_house' && ui.mode === 'play', 'new game starts outside the house');
await h.shot('02-house');

// Outside: pumpkin, key, door
await h.teleport(30, 182);
await h.say('take pumpkin');
check((await h.msg()) === 'Ok.', 'take pumpkin');
await h.close();
await h.say('open pumpkin');
check((await h.msg()).includes('reveal a key'), 'pumpkin breaks open');
await h.close();
await h.say('take key');
await h.close();
check((await h.inv()).includes('housekey'), 'key in inventory');
await h.teleport(60, 175);
await h.say('open door');
check((await h.msg()) === "It's locked.", 'door is locked');
await h.close();
await h.say('use key on door');
await h.close();
await h.say('open door');
await h.run(150);
check(!(await h.exists('obj_hhh_frontdoor')), 'front door swings open');
check((await h.go(40, 150)) === 'rm_hall', 'enter the house');
await h.run(2);
check((await h.score()) === 23, 'score 23 after entering the house');
await h.shot('03-hall');

// Hall: candle, hole, knife, whistle
await h.teleport(170, 150);
await h.say('take candle');
await h.close();
await h.teleport(70, 165);
await h.say('look hole');
const holeText = await h.msg();
check(holeText.includes('pocket knife') && holeText.includes('whistle'), 'candlelight reveals the knife and whistle');
await h.close();
await h.say('take knife');
await h.close();
await h.say('take whistle');
const whistlePages = await h.close();
check(whistlePages.length === 2, 'whistle message has two pages');

// Look around: room description and visible objects
await h.say('look');
check((await h.msg()).startsWith('You are in the grand hallway'), 'look describes the room');
await h.close();

// Lab: take the bung, then run the whole professor / Igor sequence
check((await h.go(278, 94)) === 'rm_lab', 'enter the lab');
await h.teleport(80, 150);
await h.say('take bung');
await h.close();
check((await h.inv()).includes('bung'), 'bung taken');
await h.say('look table');
check(!(await h.msg()).includes('rubber bung'), 'table no longer mentions the bung');
await h.close();
// Professor walks in and introduces himself
await h.run(200);
check((await h.msg()).includes('step into the cubicle'), 'professor asks Hugo into the cubicle');
await h.close();
await h.teleport(123, 150);
await h.run(70);
check((await h.msg()).includes('press the green button'), 'professor instructs Igor');
await h.close();
let pressed = '';
for (let i = 0; i < 60 && !pressed; i++) {
  await h.run(10);
  const m = await h.msg();
  if ((await h.run(0)).mode === 'message' && m.includes('RED button')) pressed = m;
}
check(pressed !== '', 'Igor presses the wrong (red) button');
await h.close();
// Door closes on Hugo, the arc zaps him, the door opens, the professor storms off
let frustrated = false;
for (let i = 0; i < 80 && !frustrated; i++) {
  await h.run(10);
  if ((await h.msg()).includes('colorblind minion')) frustrated = true;
}
check(frustrated, 'machine runs and the professor storms off');
check((await h.status()) === 'dizzy_', 'Hugo is dizzy after the first zap');
await h.close();
await h.run(400);
check(!(await h.exists('obj_professor_lab')), 'professor leaves the lab');
// Dizzy Hugo can't leave; cycle him back to normal with Igor's help
await h.teleport(25, 168);
await h.run(3);
check((await h.msg()).includes('cannot move your hand'), "dizzy Hugo can't open the door");
await h.close();
for (const expected of ['static_', 'mini_', '']) {
  // Wait for the sliding door to reopen before asking Igor again
  for (let i = 0; i < 60 && (await h.obj('obj_lab_door', 'o.x')) !== 80; i++) await h.run(10);
  await h.teleport(123, 150);
  await h.say('tell igor to press red button');
  let igorDone = false;
  for (let i = 0; i < 60 && !igorDone; i++) {
    await h.run(10);
    if ((await h.run(0)).mode === 'message' && (await h.msg()).startsWith('Igor grunts')) igorDone = true;
  }
  await h.close();
  for (let i = 0; i < 60 && (await h.status()) !== expected; i++) await h.run(10);
  check((await h.status()) === expected, `the arc changes Hugo to "${expected || 'normal'}"`);
}
await h.run(200);
check((await h.go(25, 168)) === 'rm_hall', 'back to normal, Hugo leaves the lab');

// Bedroom: wardrobe and mask
await h.teleport(140, 110);
await h.say('open door');
await h.close();
await h.run(130);
check((await h.go(138, 84)) === 'rm_bedroom', 'enter the bedroom');
await h.say('take mask');
check(!(await h.inv()).includes('mask') && (await h.run(0)).mode === 'play', "mask can't be taken while the wardrobe is shut");
await h.say('open door');
await h.run(130);
await h.say('take mask');
await h.close();
check((await h.inv()).includes('mask'), 'mask taken from the wardrobe');
check((await h.go(176, 134)) === 'rm_hall', 'back to the hall');

// Garden: combination lock and oil
check((await h.go(222, 144)) === 'rm_kitchen', 'enter the kitchen');
check((await h.go(227, 126)) === 'rm_garden', 'enter the garden');
await h.teleport(240, 110);
await h.say('open door');
check((await h.run(0)).mode === 'question', 'shed asks for a combination');
await h.close();
await h.say('123');
check((await h.msg()).includes("doesn't budge"), 'wrong combination rejected');
await h.close();
await h.say('unlock door');
await h.close();
await h.say('333');
check((await h.msg()).includes('Bingo'), 'combination 333 opens the shed');
await h.close();
await h.run(150);
check((await h.obj('obj_garden_shed_door', 'o.attrs.opened')) === true, 'shed door swung open');
await h.teleport(255, 80);
await h.say('look shed');
check((await h.msg()).includes('can of oil'), 'candle shows the oil in the shed');
await h.close();
await h.say('take oil');
await h.close();
check((await h.inv()).includes('oil'), 'oil taken');
check((await h.go(273, 195)) === 'rm_kitchen', 'back to the kitchen');

// Dining room: the butler and the chop
check((await h.go(275, 135)) === 'rm_diningrm', 'enter the dining room');
await h.say('wear mask');
await h.close();
check((await h.status()) === 'mask_', 'wearing the gorilla mask');
let asked = false;
// He wanders twice, then comes straight for Hugo
for (let i = 0; i < 300 && !asked; i++) {
  await h.run(10);
  if ((await h.run(0)).mode === 'question') asked = true;
}
check(asked, 'butler offers a chop');
await h.close();
await h.say('yes');
await h.close();
check((await h.inv()).includes('chop'), 'masked Hugo gets the chop');
await h.say('remove mask');
await h.close();
check((await h.go(54, 115)) === 'rm_kitchen', 'back to the kitchen');

// Storeroom: dog, carpet, trapdoor
check((await h.go(30, 142)) === 'rm_storerm', 'enter the storeroom');
await h.say('throw chop');
await h.run(240);
check((await h.msg()).includes('chowing down'), 'the dog goes for the chop');
await h.close();
await h.teleport(205, 160);
await h.say('pull carpet');
check((await h.msg()).includes('trapdoor'), 'carpet hides a trapdoor');
await h.close();
await h.say('open trapdoor');
check((await h.msg()).includes('rusty'), 'trapdoor is rusted shut');
await h.close();
await h.say('oil trapdoor');
await h.close();
await h.say('open trapdoor');
await h.close();
await h.teleport(100, 150);
await h.say('take chop');
await h.close();
check((await h.go(224, 156)) === 'rm_basement', 'down through the trapdoor');

// Bat cave
check((await h.go(160, 139)) === 'rm_batcave', 'enter the bat cave');
await h.say('blow whistle');
check((await h.msg()).includes('disoriented'), 'whistle scrambles the bats');
await h.close();
check((await h.obj('obj_bat_1', 'o.attrs.state')) === 1, 'bats are in the whistled state');
// Keep the test deterministic: park the bats out of the way
await page.evaluate(() => {
  for (const i of window.__oshTest.session.game.instances) if (i.objName.startsWith('obj_bat_')) Object.assign(i, { x: 300, y: 20 });
});
check((await h.go(118, 90)) === 'rm_mummyrm', 'into the mummy room');

// Mummy room
await h.teleport(208, 166);
await h.say('take gold');
await h.close();
for (let i = 0; i < 40 && (await h.exists('obj_coffin')); i++) await h.run(10);
check(!(await h.exists('obj_coffin')), 'taking the gold opens the coffin');
await h.run(40);
check((await h.obj('obj_mummy', 'o.attrs.move_state')) === 1, 'the mummy climbs out and attacks');
// The exit is right beside the coffin: slip past the mummy
check((await h.go(260, 100)) === 'rm_lakeroom', 'escape to the lake');
check((await h.status()) === 'mini_', 'Hugo is tiny in the lake room');

// Lake: rope, boat, old man
await h.teleport(230, 150);
await h.say('push boat');
check((await h.msg()).includes('rope prevents'), 'rope holds the boat');
await h.close();
await h.say('cut rope');
await h.close();
await h.say('enter boat');
check((await h.msg()).includes('hole'), 'the boat has a hole');
await h.close();
await h.say('use bung on boat');
await h.close();
await h.say('get in boat');
await h.close();
check(!(await h.exists('obj_player')), 'Hugo is in the boat');
await h.say('push boat');
await h.run(600);
check((await h.obj('obj_boat', 'o.attrs.position')) === 1, 'boat reaches the far shore');
await h.say('exit boat');
check((await h.msg()).includes('blocks your path'), 'the old man blocks the way');
await h.close();
await h.say('talk to man');
await h.close();
const answers = {
  Hobbit: 'bilbo',
  Aslan: 'narnia',
  Dracula: 'bram stoker',
  'gargle blaster': 'c',
  mammal: 'man',
  'Roy Rogers': 'bullet',
  'original creator': 'david gray',
  'rescue Penelope?': 'yes',
};
let answered = 0;
for (let q = 0; q < 6; q++) {
  await h.run(15);
  const text = await h.msg();
  if (text.startsWith('Excellent')) break;
  const key = Object.keys(answers).find((k) => text.includes(k));
  if (!key) break;
  await h.close();
  await h.say(answers[key]);
  answered++;
}
await h.run(15);
check(answered === 5 && (await h.msg()).startsWith('Excellent'), 'answers all five questions');
await h.close();
await h.say('exit boat');
await h.close();
check(await h.exists('obj_player'), 'Hugo steps onto the far shore');

// Dead end, guard, jail
check((await h.go(308, 67)) === 'rm_deadend', 'reach the dead end');
check((await h.status()) === '', 'Hugo is back to normal size');
await h.teleport(158, 110);
await h.say('give guard a smile');
check((await h.msg()).includes('refuses'), 'guard wants money');
await h.close();
await h.say('give gold to guard');
await h.close();
await h.run(120);
check((await h.obj('obj_guard', 'o.x')) === 120, 'guard steps aside');
check((await h.score()) === 198, 'maximum score 198 reached (' + (await h.score()) + ')');
await h.shot('04-before-jail');
check((await h.go(159, 67)) === 'rm_jail', 'Penelope is rescued');
await h.run(130);
check((await h.msg()).startsWith('Congratulations'), 'ending message');
await h.close();
await h.run(20);
check((await h.room()) === 'rm_theend', 'the end screen');
await h.run(130);
await h.close();
await h.run(20);
check(!(await page.evaluate(() => window.__oshTest.playing)), 'game finishes and returns to the title');
check((await page.textContent('#titleStatus')).includes('Thank you'), 'title says thank you');

// ===========================================================================
console.log('Menus, saves and dying');
await page.evaluate(() => window.__oshTest.startGame(null));
await h.run(3);
await h.key(112); // F1
check((await h.msg()).startsWith('ESC - Quit game'), 'F1 shows help');
await h.key(112);
check((await h.msg()).startsWith('You may control Hugo'), 'F1 again shows instructions');
await h.close();
await h.key(113); // F2 options
check((await h.run(0)).mode === 'options', 'F2 opens options');
await h.key(40);
await h.key(39);
check((await h.msg()).includes('>Music'), 'options cursor moves');
await h.key(27);
await h.teleport(30, 182);
await h.say('take pumpkin');
await h.close();
await h.key(115); // F4 save
check((await h.run(0)).mode === 'menu-save', 'F4 opens the save menu');
await h.key(40);
await h.key(13);
check((await h.run(0)).textTarget === 'savename', 'naming the save');
await page.evaluate(() => window.__oshTest.session.setText('Pumpkin taken!'));
await h.run(1);
check((await h.msg()).includes('Pumpkin taken_'), 'save name filters punctuation');
await h.key(13, 5);
check((await h.room()) === 'rm_house' && (await page.evaluate(() => localStorage.getItem('osh:SAVE1.SAV') !== null)), 'game saved to slot 2');
await h.say('open pumpkin');
await h.close();
check(!(await h.inv()).includes('pumpkin'), 'pumpkin opened after saving');
await h.key(116); // F5 restore
await h.key(40);
await h.key(13, 5);
check((await h.inv()).includes('pumpkin'), 'restore brings the pumpkin back');
check(await h.exists('obj_hhh_pumpkin') === false && (await h.exists('obj_hhh_key')) === false, 'restored room state is consistent');
await h.key(117); // F6 inventory
check((await h.msg()).includes('pumpkin'), 'F6 lists the inventory');
await h.close();
await h.say('xyzzy');
check((await h.msg()) === 'I\'m not sure what you mean by "xyzzy".', 'unknown command');
await h.close();
await h.key(114); // F3 last line
check((await h.run(0)).text === 'xyzzy', 'F3 recalls the last line');
await h.say('');
await page.evaluate(() => window.__oshTest.session.setText(''));
await h.key(27);
check((await h.run(0)).mode === 'quit', 'Esc asks to quit');
await h.key(78);
check((await h.run(0)).mode === 'play', 'N cancels quitting');
// Autosave snapshot and continue
const snap = await page.evaluate(() => JSON.stringify(window.__oshTest.session.snapshot()));
await page.evaluate((s) => window.__oshTest.startGame(JSON.parse(s)), snap);
await h.run(3);
check((await h.room()) === 'rm_house' && (await h.inv()).includes('pumpkin'), 'continue from autosave');
// Death by dog
await h.say('debug me bby');
check((await h.msg()) === 'Debug mode is now ON', 'debug mode toggles');
await h.close();
await h.say('debug giveitem whistle');
await h.close();
await h.say('debug goto hall');
check((await h.room()) === 'rm_hall', 'debug goto');
await h.say('blow whistle');
await h.close();
check(await h.exists('obj_dog'), 'whistle in the hall summons the dog');
// (In OSH the summoned dog spawns slightly inside a wall and can't move, so walk into it)
await h.teleport(262, 168);
await h.run(3);
check((await h.msg()).includes('puppy chow'), 'the dog eats Hugo');
await h.close();
await h.say('look');
check((await h.msg()) === 'You are too dead to do that.', 'dead Hugo can only lie there');
await h.close();

// ===========================================================================
console.log('UI');
await page.evaluate(() => window.__oshTest.startGame(null));
await page.evaluate(() => window.__oshTest.setManual(false));
await page.waitForTimeout(300);
await page.fill('#cmd', 'look');
await page.press('#cmd', 'Enter');
await page.waitForTimeout(300);
check((await h.run(0)).mode === 'message', 'typing in the command box and pressing Enter works');
check(await page.isHidden('#dpad'), 'the pad makes room for the keyboard while typing');
await h.shot('05-message-typing');
await page.evaluate(() => document.getElementById('cmd').blur());
await page.waitForTimeout(200);
await h.shot('05b-message-portrait');
await page.click('#context .key.primary');
check((await h.run(3)).mode === 'play', 'OK button closes the message');
await page.evaluate(() => window.__oshTest.setManual(false));
await page.dispatchEvent('#dpad [data-key="37"]', 'pointerdown');
await page.waitForTimeout(500);
const walk = await page.evaluate(() => window.__oshTest.session.uiState().walking);
check(walk === 'left', 'D-pad starts Hugo walking');
await h.shot('06-walking-portrait');
const pixels = await page.evaluate(() => {
  const c = document.getElementById('screen');
  const d = c.getContext('2d').getImageData(0, 0, 320, 200).data;
  let lit = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 0) lit++;
  return lit;
});
check(pixels > 20000, 'the game screen is drawn (' + pixels + ' lit pixels)');
const box = await page.evaluate(() => {
  const r = document.getElementById('screen').getBoundingClientRect();
  return { w: r.width, h: r.height };
});
check(Math.abs(box.w / box.h - 1.6) < 0.02 && box.w > 380, `portrait screen fills the width (${box.w.toFixed(1)}x${box.h.toFixed(1)} css px)`);
await page.setViewportSize({ width: 905, height: 412 });
await page.waitForTimeout(300);
const lbox = await page.evaluate(() => {
  const r = document.getElementById('screen').getBoundingClientRect();
  const d = document.getElementById('dpad').getBoundingClientRect();
  return { w: r.width, h: r.height, left: r.left, dpadRight: d.right };
});
check(lbox.h > 300 && lbox.dpadRight <= lbox.left + 1, `landscape: big screen with the D-pad beside it (${lbox.w.toFixed(0)}x${lbox.h.toFixed(0)})`);
await h.shot('07-landscape');
await page.setViewportSize(PHONE.viewport);

// ===========================================================================
console.log('Casting');
const tvContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const tv = await tvContext.newPage();
await tv.goto(base + '/receiver/index.html?local=1');
await tv.waitForFunction(() => typeof window.__oshReceive === 'function');
// Wire phone <-> TV the way the Android shell does
await page.exposeFunction('__toTv', (json) => tv.evaluate((j) => window.__oshReceive(j), json));
await tv.exposeFunction('__toPhone', (json) => page.evaluate((j) => window.__osh.onCastMessage(j), json));
await tv.evaluate(() => (window.__oshReply = (j) => window.__toPhone(j)));
await page.evaluate(() => (window.__oshDevCast = { send: (j) => window.__toTv(j) }));
await page.evaluate(() => window.__osh.onCastState('CONNECTED', 'Test TV'));
await page.waitForFunction(() => window.__oshTest.cast.live, null, { timeout: 15000 });
check(true, 'TV received the sprite atlas and is live');
await page.evaluate(() => window.__oshTest.setManual(false));
await page.waitForTimeout(800);
// Freeze the game and push the final frame so both screens settle
await h.run(1);
await page.waitForTimeout(500);
const same = await Promise.all([page, tv].map((p) => p.evaluate(() => document.getElementById('screen').toDataURL())));
check(same[0] === same[1], 'TV shows exactly the same picture as the phone');
if (shots) await tv.screenshot({ path: path.join(shots, '08-tv.png') });
check(!(await page.isHidden('#castBadge')), 'phone shows the "On TV" badge');
// Reconnect: the TV keeps the atlas cached and goes live without a resend
let chunks = 0;
await page.evaluate(() => {
  const orig = window.__oshDevCast.send;
  window.__chunks = 0;
  window.__oshDevCast.send = (j) => {
    if (j.startsWith('{"t":"chunk"')) window.__chunks++;
    orig(j);
  };
});
await page.evaluate(() => window.__osh.onCastState('NOT_CONNECTED', ''));
await page.evaluate(() => window.__osh.onCastState('CONNECTED', 'Test TV'));
await page.waitForFunction(() => window.__oshTest.cast.live, null, { timeout: 15000 });
chunks = await page.evaluate(() => window.__chunks);
check(chunks === 0, 'reconnecting reuses the cached atlas');

check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));

await browser.close();
server.close();
console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
