export type PlanningFolder = { id: string; name: string };
export type PlanningNote = { id: string; folderId: string | null; title: string; body: string };
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
    folderIds.add(folder.id);
  }
  for (const note of value.notes) {
    if (!note || !validRecordId(note.id) || noteIds.has(note.id) || typeof note.title !== 'string' || note.title.length > 120 || typeof note.body !== 'string' || (note.folderId !== null && !folderIds.has(note.folderId))) throw Error('Invalid planning note.');
    noteIds.add(note.id);
  }
  return { folders: value.folders.map(f => ({ id: f.id, name: f.name })), notes: value.notes.map(n => ({ id: n.id, folderId: n.folderId, title: n.title, body: n.body })) };
}
export function removePlanningFolder(data: PlanningData, id: string): PlanningData {
  return { folders: data.folders.filter(f => f.id !== id), notes: data.notes.filter(n => n.folderId !== id) };
}
