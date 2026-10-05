// The Android shell exposes `OSHNative` to the page (a @JavascriptInterface)
// and calls back into `window.__osh`. In a desktop browser none of this
// exists and the game runs stand-alone.

export interface NativeBridge {
  haptic(): void;
  quit(): void;
  setFullscreen(on: boolean): void;
  setKeepScreenOn(on: boolean): void;
  castState(): string;
  openCastDialog(): void;
  castSend(json: string): void;
  getCastAppId(): string;
  setCastAppId(id: string): void;
  appVersion(): string;
}

declare global {
  interface Window {
    OSHNative?: NativeBridge;
    __osh?: NativeCallbacks;
    /** Test hook: lets an automated test act as the TV side. */
    __oshDevCast?: { send(json: string): void };
  }
}

export interface NativeCallbacks {
  /** Cast state changed: NO_DEVICES | NOT_CONNECTED | CONNECTING | CONNECTED | UNAVAILABLE | DISPLAY */
  onCastState(state: string, device: string): void;
  /** A message from the receiver (Chromecast or secondary display). */
  onCastMessage(json: string): void;
  /** The Android back button was pressed. */
  onBack(): void;
}

export const native: NativeBridge | null = typeof window !== 'undefined' && window.OSHNative ? window.OSHNative : null;
