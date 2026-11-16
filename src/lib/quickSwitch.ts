import type { Item } from './catalog';
import type { DesignSection } from './design';

type Destination =
  | { kind: 'item'; itemId: number }
  | { kind: 'planet'; planetId: string }
  | { kind: 'factory'; planetId: string; factoryId: string }
  | { kind: 'todo'; planetId: string; taskId: string };

export type QuickSwitchEntry = Destination & { key: string; name: string; context: string };

export function quickSwitchEntries(items: Item[], sections: DesignSection[]): QuickSwitchEntry[] {
  const systems = new Map(sections.filter(section => section.kind === 'system').map(system => [system.id, system.name]));
  const entries: QuickSwitchEntry[] = [];
  for (const planet of sections) {
    if (planet.kind !== 'planet') continue;
    const system = (planet.parentId && systems.get(planet.parentId)) || 'Unassigned system';
    const name = planet.name || 'Untitled planet';
    const context = `${system} → ${name}`;
    entries.push({ kind: 'planet', key: `planet:${planet.id}`, planetId: planet.id, name, context: system });
    for (const factory of Object.values(planet.factories ?? {})) {
      entries.push({ kind: 'factory', key: `factory:${planet.id}:${factory.id}`, planetId: planet.id, factoryId: factory.id, name: factory.name, context });
    }
    for (const task of planet.checklist ?? []) {
      entries.push({ kind: 'todo', key: `todo:${planet.id}:${task.id}`, planetId: planet.id, taskId: task.id, name: task.text.trim() || 'Untitled task', context });
    }
  }
  for (const item of items) {
    entries.push({ kind: 'item', key: `item:${item.id}`, itemId: item.id, name: item.name, context: '' });
  }
  return entries;
}

const kindLabels = { item: 'Item', planet: 'Planet', factory: 'Saved factory', todo: 'To-do' };
export const quickSwitchKindLabel = (entry: QuickSwitchEntry) => kindLabels[entry.kind];

export function searchQuickSwitch(entries: QuickSwitchEntry[], query: string): QuickSwitchEntry[] {
  const term = query.trim().toLowerCase();
  const words = term.split(/\s+/).filter(Boolean);
  if (!words.length) return entries.slice(0, 12);
  return entries.flatMap(entry => {
    const name = entry.name.toLowerCase();
    const searchable = `${name} ${entry.context.toLowerCase()} ${quickSwitchKindLabel(entry).toLowerCase()}`;
    if (!words.every(word => searchable.includes(word))) return [];
    const rank = name === term ? 0 : name.startsWith(term) ? 1 : words.every(word => name.includes(word)) ? 2 : 3;
    return [{ entry, rank }];
  }).sort((a, b) => a.rank - b.rank || a.entry.name.localeCompare(b.entry.name))
    .slice(0, 12).map(({ entry }) => entry);
}
