// Platform services the game needs from its host (Android shell or browser).

export interface Platform {
  /** game_end(): close the app (or return to the title screen in a browser). */
  quit(): void;
  /** window_set_fullscreen */
  setFullscreen(on: boolean): void;
  /** Persistent key/value storage for saves and settings. */
  load(key: string): string | null;
  save(key: string, value: string): boolean;
  remove(key: string): void;
}

const memory = new Map<string, string>();

export const platform: Platform = {
  quit() {},
  setFullscreen() {},
  load(key) {
    try {
      return localStorage.getItem('osh:' + key);
    } catch {
      return memory.get(key) ?? null;
    }
  },
  save(key, value) {
    try {
      localStorage.setItem('osh:' + key, value);
      return true;
    } catch {
      memory.set(key, value);
      return true;
    }
  },
  remove(key) {
    try {
      localStorage.removeItem('osh:' + key);
    } catch {
      memory.delete(key);
    }
  },
};

export function setPlatform(p: Partial<Platform>): void {
  Object.assign(platform, p);
}
