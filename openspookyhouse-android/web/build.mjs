// Bundles the phone app and the Chromecast receiver.
//   dist/app/       -> copied into the Android app (android/app/src/main/assets/www)
//   dist/receiver/  -> hosted on HTTPS for the Cast receiver, and also shipped
//                      inside the app for wired / Miracast secondary displays
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const root = path.dirname(new URL(import.meta.url).pathname);
const dist = path.join(root, 'dist');
const androidAssets = path.join(root, '..', 'android', 'app', 'src', 'main', 'assets', 'www');
const serve = process.argv.includes('--serve');

const common = {
  bundle: true,
  format: 'iife',
  target: ['chrome100'],
  minify: !serve,
  sourcemap: serve ? 'inline' : false,
  legalComments: 'none',
  logLevel: 'info',
};

function copyStatic(outDir, files) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const [from, to] of files) {
    const src = path.join(root, 'static', from);
    const dst = path.join(outDir, to);
    if (fs.statSync(src).isDirectory()) fs.cpSync(src, dst, { recursive: true });
    else fs.copyFileSync(src, dst);
  }
}

fs.rmSync(dist, { recursive: true, force: true });
copyStatic(path.join(dist, 'app'), [
  ['index.html', 'index.html'],
  ['app.css', 'app.css'],
  ['font.png', 'font.png'],
  ['masks', 'masks'],
]);
copyStatic(path.join(dist, 'receiver'), [
  ['receiver.html', 'index.html'],
  ['font.png', 'font.png'],
]);

const builds = [
  { ...common, entryPoints: [path.join(root, 'src/ui/app.ts')], outfile: path.join(dist, 'app/app.js') },
  { ...common, entryPoints: [path.join(root, 'src/receiver/receiver.ts')], outfile: path.join(dist, 'receiver/receiver.js') },
];

if (serve) {
  const ctxs = await Promise.all(builds.map((b) => esbuild.context(b)));
  await Promise.all(ctxs.map((c) => c.watch()));
  const s = await ctxs[0].serve({ servedir: dist, port: 8080 });
  console.log(`Serving http://localhost:${s.port}/app/ and /receiver/`);
} else {
  await Promise.all(builds.map((b) => esbuild.build(b)));
  // The app bundle (and a local copy of the receiver) ship inside the APK
  fs.rmSync(androidAssets, { recursive: true, force: true });
  fs.cpSync(path.join(dist, 'app'), androidAssets, { recursive: true });
  fs.cpSync(path.join(dist, 'receiver'), path.join(androidAssets, 'receiver'), { recursive: true });
  console.log('Copied web build to', path.relative(process.cwd(), androidAssets));
}
