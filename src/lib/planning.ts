export type PlanningFolder = { id: string; name: string; order?: number };
export const todoTypes = ['import','export','production','power','issue'] as const;
export type TodoType = typeof todoTypes[number];
export type ChecklistItem = { type?:TodoType; id:string; text:string; done:boolean };
export type PlanningNote = { checklist?: ChecklistItem[]; id: string; folderId: string | null; title: string; body: string; order?: number };
export type PlanningData = { folders: PlanningFolder[]; notes: PlanningNote[] };
export const emptyPlanning = (): PlanningData => ({ folders: [], notes: [] });
export function validRecordId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id) && !['__proto__', 'constructor', 'prototype'].includes(id);
}
export function validatePlanning(input: unknown): PlanningData {
  if (input === undefined) return emptyPlanning();
  if (!input || typeof input !== 'object') throw Error('Invalid planning data.');
  const value = input as PlanningData;
  if (!Array.isArray(value.folders) || !Array.isArray(value.notes)) throw Error('Invalid planning data.');
  const folderIds = new Set<string>(), noteIds = new Set<string>();
  for (const folder of value.folders) {
    if (!folder || !validRecordId(folder.id) || folderIds.has(folder.id) || typeof folder.name !== 'string' || folder.name.length > 120) throw Error('Invalid planning folder.');
    if (folder.order !== undefined && !Number.isFinite(folder.order)) throw Error('Invalid folder order.');
    folderIds.add(folder.id);
  }
  for (const note of value.notes) {
    if (!note || !validRecordId(note.id) || noteIds.has(note.id) || typeof note.title !== 'string' || note.title.length > 120 || typeof note.body !== 'string' || (note.folderId !== null && !folderIds.has(note.folderId))) throw Error('Invalid planning note.');
    if (note.order !== undefined && !Number.isFinite(note.order)) throw Error('Invalid note order.');
    if(note.checklist !== undefined && (!Array.isArray(note.checklist)||note.checklist.length>1000||new Set(note.checklist.map(t=>t.id)).size!==note.checklist.length||note.checklist.some(t=>!t||!validRecordId(t.id)||typeof t.text!=='string'||t.text.length>1000||typeof t.done!=='boolean'||(t.type!==undefined&&!todoTypes.includes(t.type))))) throw Error('Invalid checklist.');
    noteIds.add(note.id);
  }
  return { folders: value.folders.map(f => ({ id: f.id, name: f.name, ...(f.order === undefined ? {} : { order: f.order }) })), notes: value.notes.map(n => ({ id: n.id, folderId: n.folderId, title: n.title, body: n.body, ...(n.checklist===undefined?{}:{checklist:n.checklist.map(t=>({...t}))}), ...(n.order === undefined ? {} : { order: n.order }) })) };
}
export function removePlanningFolder(data: PlanningData, id: string): PlanningData {
  return { folders: data.folders.filter(f => f.id !== id), notes: data.notes.filter(n => n.folderId !== id) };
}

export function ordered<T extends { order?: number }>(entries: T[]): T[] {
  return entries.map((entry, index) => ({ entry, index })).sort((a,b) => (a.entry.order ?? a.index) - (b.entry.order ?? b.index) || a.index - b.index).map(value => value.entry);
}
export function reorderPlanning(data: PlanningData, kind: 'folder' | 'note', source: string, target: string): PlanningData {
  const entries = kind === 'folder' ? data.folders : data.notes;
  const from = entries.find(entry => entry.id === source), to = entries.find(entry => entry.id === target);
  if (!from || !to || source === target) return data;
  if (kind === 'note' && (from as PlanningNote).folderId !== (to as PlanningNote).folderId) return data;
  const siblings = ordered(entries.filter(entry => kind === 'folder' || (entry as PlanningNote).folderId === (from as PlanningNote).folderId));
  const fromIndex = siblings.findIndex(entry => entry.id === source), toIndex = siblings.findIndex(entry => entry.id === target);
  siblings.splice(fromIndex, 1); siblings.splice(toIndex, 0, from);
  const ranks = new Map(siblings.map((entry, index) => [entry.id, index]));
  if (kind === 'folder') return { ...data, folders: data.folders.map(entry => ranks.has(entry.id) ? { ...entry, order: ranks.get(entry.id)! } : entry) };
  return { ...data, notes: data.notes.map(entry => ranks.has(entry.id) ? { ...entry, order: ranks.get(entry.id)! } : entry) };
}
export function nextScratchTitle(notes: PlanningNote[]): string {
  const numbers = notes.map(note => /^scratch (\d+)$/i.exec(note.title.trim())).filter(Boolean).map(match => Number(match![1]));
  return `scratch ${Math.max(0, ...numbers) + 1}`;
}
export function nextOrder(entries: { order?: number }[]): number {
  return Math.max(-1, ...entries.map((entry, index) => entry.order ?? index)) + 1;
}
