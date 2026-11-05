import type { ChecklistItem } from './planning';

/** Reorder visible slots while keeping tasks outside the current filter in place. */
export function reorderTodos(entries: ChecklistItem[], visibleIds: string[], sourceId: string, targetId: string) {
  const visibleSet = new Set(visibleIds);
  const ordered = entries.filter(entry => visibleSet.has(entry.id));
  const from = ordered.findIndex(entry => entry.id === sourceId);
  const to = ordered.findIndex(entry => entry.id === targetId);
  if (from < 0 || to < 0 || from === to) return entries;
  const [moved] = ordered.splice(from, 1);
  ordered.splice(to, 0, moved);
  let index = 0;
  return entries.map(entry => visibleSet.has(entry.id) ? ordered[index++] : entry);
}
