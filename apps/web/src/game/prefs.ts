/**
 * Small per-browser memories, such as "has seen the briefing". Storage can be
 * missing or blocked (private windows, embedded previews), so every access is
 * guarded and the game works the same without it.
 */

const PREFIX = 'ripple.';

export function readPref<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writePref(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage unavailable: the preference lasts for this visit only.
  }
}
