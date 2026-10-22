import { RECENTS_KEY, RECENTS_MAX } from "./constants";

export function loadRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export function pushRecent(title: string): string[] {
  const without = loadRecents().filter((t) => t !== title);
  const next = [title, ...without].slice(0, RECENTS_MAX);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  return next;
}
