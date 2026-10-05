# OpenSpookyHouse for Android (with Chromecast)

An Android port of [OpenSpookyHouse](https://github.com/Skyline969/openspookyhouse) by Logan Baron, the free GameMaker remake of *Hugo's House of Horrors*. It's tuned for the Oppo Find X8 Ultra and can show the game on a TV through a Chromecast.

The game logic is a line-by-line port of the original GameMaker code to TypeScript. That covers every room, object, puzzle, message, score flag and the save format. It runs on a small GameMaker-style runtime that keeps GameMaker's event order, alarms, depth sorting and collision rules.

> **You need your own copy of Hugo's House of Horrors.** As with the PC version of OpenSpookyHouse, the graphics are read from the original game's files on first launch. This app and repository contain no assets from the original game.

## Install

1. Download the APK.
   - Open the latest **OpenSpookyHouse Android** run on the repository's **Actions** tab.
   - Download the `OpenSpookyHouse-apk` artifact and unzip it.
   - Install `app-release.apk` on the phone. Android asks once to allow installs from your browser or file manager.
2. Copy the game files to the phone, for example into Downloads:
   - **GOG "The Hugo Trilogy":** `OBJECTS.DAT` and `SCENERY.DAT` from the Hugo's House of Horrors folder. `SOUNDS.DAT` is optional.
   - **Original DOS version:** all of the `.PIX` and `.ART` files.
   - A `.zip` containing either set works too.
3. Open the app and tap **Choose game files**, then select the files. They're copied into the app's private storage, so you only do this once.

## Controls

| | Touch | Keyboard / gamepad |
|---|---|---|
| Walk (tap once to start, again to stop) | D-pad; ■ stops | Arrow keys / numpad / D-pad |
| Type a command (`look`, `take key`, `use knife on rope`…) | Command box + quick verb buttons | Just type |
| Enter / continue a message | ⏎, **OK**, or tap the picture | Enter |
| Esc (close message, quit prompt) | **Esc** button or Android Back | Esc |
| Help, Options, Last line, Save, Restore, Inventory | F1–F6 buttons | F1–F6 |

- **Layouts:** portrait puts the game on top with the controls under your thumbs. Landscape puts the D-pad and function keys on either side of a large picture. While you type, the controls step aside to make room for the keyboard.
- **Settings (☰):**
  - Picture shape: 16:10 square pixels, or 4:3 like the original DOS game.
  - Pixel-perfect integer scaling.
  - Haptics.
  - Quick verbs.
  - The Chromecast App ID.
- **Autosave:** the game is saved automatically whenever the app goes to the background, and **Continue** resumes it. The eight F4/F5 save slots work as in the original.

## Playing on a TV

The game always runs on the phone, and the TV only displays it, so saves, timing and input stay local.

| Option | Setup | Result |
|---|---|---|
| **Chromecast (recommended)** | One-time setup, below | Full-screen game on the TV; the phone becomes the controller |
| USB-C → HDMI/DisplayPort cable, or a Miracast display | None | Detected automatically (Android Presentation display); TV shows the game full-screen |
| Screen mirroring (Quick Settings → Cast, or Google Home → Cast my screen) | None | Mirrors the phone's whole screen, controls included |

### One-time Chromecast setup

A Chromecast runs a small web page called a *Web Receiver*, which Google requires to be registered:

1. **Host the receiver page.** It's built to `web/dist/receiver/`. Either:
   - **GitHub Pages:**
     1. In the repository's **Settings → Pages**, set **Source** to **GitHub Actions**.
     2. Run the **OpenSpookyHouse Cast receiver (GitHub Pages)** workflow from the Actions tab.
     3. The receiver URL is `https://<user>.github.io/<repo>/`. For this repository that's `https://jarrodfeng.github.io/fengfilms/`.
   - **Cloudflare Workers:** from `openspookyhouse-android/web`, run `npm ci && npm run build`. Then run `npx wrangler deploy -c ../receiver-hosting/wrangler.json`.
2. **Register it.**
   1. Open the [Google Cast SDK Developer Console](https://cast.google.com/publish). Google charges a one-time US$5 registration fee.
   2. Click **Add new application → Custom Receiver** and enter the receiver URL.
   3. Note the 8-character **App ID**.
3. **Let your Chromecast use it.** Do one of these:
   - Under **Devices**, add your Chromecast's serial number, then reboot the Chromecast. The serial number is in the Google Home app → device → Settings → Device information.
   - **Publish** the application, which makes it work on every Chromecast.
4. **Tell the app.** Open ☰ → **Chromecast → Cast receiver App ID** and enter the ID. You can also bake it into the build with `./gradlew assembleRelease -PoshCastAppId=XXXXXXXX`.
5. **Cast.** Tap the cast icon and pick your Chromecast. The game appears on the TV and the phone shows **On TV**.

The first connection sends the sprite sheet to the TV in about a second. The Chromecast caches it, so later connections are instant.

**Cast protocol.** Messages use the custom namespace `urn:x-cast:com.openspookyhouse.game`:
- The phone sends the sprite atlas once, as 48 KB PNG chunks, because the Cast channel limit is 64 KB per message.
- After that, every frame is a compact draw list of sprite, rectangle and text commands: usually under 1 KB, at up to 30 updates a second, sent only when the picture changes.
- The TV renders that list with the same renderer the phone uses, so the two pictures are pixel-identical. The automated tests check this.

## Oppo Find X8 Ultra notes

- **Display and frame rate:** the game steps at a fixed 60 Hz, exactly like the GameMaker original, independent of the panel's 1–120 Hz LTPO refresh. It only redraws when a step has run.
- **Rendering:** the picture is drawn at its native 320×200 and scaled by the GPU with nearest-neighbour filtering, so pixels stay crisp on the 1440×3168 screen at almost no cost.
- **Screen and system integration:**
  - Edge-to-edge immersive mode.
  - Correct spacing around the punch-hole camera in both orientations.
  - The keyboard resizes the layout instead of covering the game.
  - The WebView renderer runs at foreground priority.
  - The app declares itself a game (`appCategory="game"` and a game-mode config), so ColorOS's game tools and Android's performance game mode can apply.
- **Google Play services:** Chromecast casting needs them, which the global Find X8 Ultra has. On a China-ROM phone without them, the cast button stays hidden; use a cable, Miracast or screen mirroring instead.
- **Requirements:** Android 8.0 or newer. There's no native code, so it runs on any ABI.

## Project layout

```
openspookyhouse-android/
├── web/                         TypeScript: game, renderer, phone UI, TV receiver
│   ├── src/engine/              GameMaker-style runtime (rooms, events, alarms, collisions)
│   ├── src/game/                The OSH port: objects/, scripts, parser, items, rooms data
│   ├── src/assets/              Readers for OBJECTS/SCENERY.DAT and .PIX/.ART, sprite atlas
│   ├── src/render/              Draw lists, bitmap font, canvas renderer (shared phone/TV)
│   ├── src/cast/                Phone side of the cast protocol + Android bridge
│   ├── src/receiver/            Chromecast / secondary-display receiver
│   ├── src/ui/                  Touch UI, title/import screen, settings, main loop
│   ├── static/                  HTML/CSS, the OSH bitmap font and depth masks
│   ├── tools/extract-osh.mjs    Regenerates room/font/mask data from an OSH checkout
│   └── test/                    End-to-end tests with synthetic placeholder game files
├── android/                     Kotlin app: WebView host, Cast sender, Presentation display
└── receiver-hosting/            Cloudflare Workers config for hosting the receiver
```

## Building

- **Web part (game, UI, receiver):**
  ```
  cd openspookyhouse-android/web
  npm ci
  npm run typecheck
  npm run build      # also copies the bundle into android/app/src/main/assets/www
  npm test           # plays the game through end to end in headless Chromium
  ```
  `npm test` checks the full game route to the maximum 198 points and the ending. It also covers saving, restoring, menus, deaths, autosave, the touch UI, and casting to a simulated TV. It uses generated stand-in files (coloured boxes) instead of the real game data.
- **Android app:** open `openspookyhouse-android/android` in Android Studio, or run `./gradlew assembleRelease`. The release build is minified and signed with the debug key unless you provide `keystore.properties` or the `OSH_KEYSTORE_*` variables (see `app/build.gradle.kts`).
- **CI:** GitHub Actions (`.github/workflows/openspookyhouse-android.yml`) does all of the above on every push and publishes the APKs as artifacts.
- **Updating from upstream:** if OpenSpookyHouse changes its rooms, run `node tools/extract-osh.mjs /path/to/openspookyhouse` to regenerate `src/game/data.generated.ts`, the font and the masks.

## Differences from the PC version

**Additions for mobile:**
- Touch controls.
- Autosave/continue.
- A ZIP import option.
- Casting and secondary displays.
- The title screen's "Thank you for playing" returns to the menu instead of closing the app.

**Small fixes:**
- Left/Right in an ordinary message no longer turns it into the options screen.
- Cancelling the options screen now really restores the previous values.

**Kept as in OpenSpookyHouse:**
- Sound and music aren't implemented upstream yet, so the Sound/Music/Audio options have no effect here either.
- The dog summoned by the whistle appears partly inside a wall and stays put.

## License and credits

- **OpenSpookyHouse** © Logan Baron, licensed under the GNU GPL v3. This port is a derivative work and is also under the [GPL v3](LICENSE).
- The bitmap font is the OpenSpookyHouse rendering of **Press Start 2P** by CodeMan38, licensed under the SIL Open Font License 1.1.
- **Hugo's House of Horrors** © David P. Gray / Gray Design Associates. None of its files are included; you need your own copy.
