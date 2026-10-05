// Keeps the player's imported game files in IndexedDB (app-private storage),
// so they only have to be picked once. Sprites are rebuilt from them on every
// launch, which takes a fraction of a second and never goes stale.
import { AssetFiles } from './build';

const DB = 'openspookyhouse';
const STORE = 'gamefiles';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function loadStoredFiles(): Promise<AssetFiles> {
  const files: AssetFiles = new Map();
  try {
    const db = await open();
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    await new Promise<void>((resolve, reject) => {
      const req = store.openCursor();
      req.onsuccess = () => {
        const cur = req.result;
        if (!cur) return resolve();
        files.set(String(cur.key), new Uint8Array(cur.value as ArrayBuffer));
        cur.continue();
      };
      req.onerror = () => reject(req.error);
    });
    db.close();
  } catch (e) {
    console.warn('Could not read stored game files', e);
  }
  return files;
}

export async function storeFiles(files: AssetFiles, replace: boolean): Promise<void> {
  const db = await open();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  if (replace) store.clear();
  for (const [name, data] of files) store.put(data.slice().buffer, name);
  await done(tx);
  db.close();
}

export async function clearFiles(): Promise<void> {
  const db = await open();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).clear();
  await done(tx);
  db.close();
}
