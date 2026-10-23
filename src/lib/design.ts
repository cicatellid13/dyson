export const DESIGN_KEY = 'dsp-design-v1';
export type TradeEntry = {
  id: string;
  itemId: number;
  amount: string;
  unit: 'items/min' | 'items/s' | 'items';
  destination: string;
  planetId?: string | null;
};
export type DesignSection = {
  id: string;
  kind: 'planet' | 'system';
  parentId: string | null;
  name: string;
  notes: string;
  planetType?: string;
  imports: TradeEntry[];
  exports: TradeEntry[];
};
export type DesignData = { version: 1; sections: DesignSection[] };
export const emptyDesign = (): DesignData => ({ version: 1, sections: [] });
export function createSection(name: string, kind: DesignSection['kind'], parentId: string | null = null): DesignSection {
  if (kind === 'planet' && !parentId) throw Error('Choose a system before creating a planet.');
  if (kind === 'system' && parentId !== null) throw Error('Systems cannot be nested.');
  return { id: crypto.randomUUID(), kind, parentId, name: name.trim(), notes: '', imports: [], exports: [] };
}
export function removeSection(data: DesignData, id: string): DesignData {
  return { ...data, sections: data.sections.filter(section => section.id !== id && section.parentId !== id) };
}
export function parseDesign(raw: string | null): DesignData {
  if (raw === null) return emptyDesign();
  const data = JSON.parse(raw) as DesignData;
  if (data?.version !== 1 || !Array.isArray(data.sections)) throw Error('Unsupported design data.');
  const ids = new Set<string>();
  for (const s of data.sections) {
    if (!s || typeof s.id !== 'string' || ids.has(s.id) || !['planet', 'system'].includes(s.kind) ||
      typeof s.name !== 'string' || typeof s.notes !== 'string' || (s.parentId !== null && typeof s.parentId !== 'string')) throw Error('Invalid design section.');
    if (s.planetType !== undefined && (typeof s.planetType !== 'string' || s.planetType.length > 120)) throw Error('Invalid planet type.');
    ids.add(s.id);
    for (const list of [s.imports, s.exports]) {
      if (!Array.isArray(list) || list.some(e => !e || typeof e.id !== 'string' || !Number.isInteger(e.itemId) || typeof e.amount !== 'string' ||
        !['items/min', 'items/s', 'items'].includes(e.unit) || typeof e.destination !== 'string' || (e.planetId !== undefined && e.planetId !== null && typeof e.planetId !== 'string'))) throw Error('Invalid import/export list.');
    }
  }
  for (const s of data.sections) {
    if (s.parentId !== null && (s.kind !== 'planet' || !data.sections.some(parent => parent.id === s.parentId && parent.kind === 'system' && parent.parentId === null))) throw Error('Invalid planet hierarchy.');
  }
  return data;
}
