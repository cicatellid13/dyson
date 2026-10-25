import { emptyPlanning, validatePlanning, type PlanningData } from './planning';
import { emptyDesign, parseDesign, type DesignData } from './design';
export type Workspace = { defaultCatalogView?: 'list' | 'grid'; design: DesignData; favorites: number[]; darkFog: boolean; planning: PlanningData };
export type SyncView = { data: Workspace; status: 'synced' | 'pending' | 'offline' | 'conflict'; message: string };
export function emptyWorkspace(): Workspace { return { design: emptyDesign(), favorites: [], darkFog: false, planning: emptyPlanning() }; }
export function validateWorkspace(input: unknown): Workspace {
  if (!input || typeof input !== 'object') throw Error('Invalid workspace.');
  const value = input as Workspace;
  const design = parseDesign(JSON.stringify(value.design));
  if (!Array.isArray(value.favorites) || !value.favorites.every(Number.isInteger) || typeof value.darkFog !== 'boolean') throw Error('Invalid workspace.');
  if (design.sections.some(section => (!/^[a-zA-Z0-9_-]+$/.test(section.id) || ['__proto__', 'constructor', 'prototype'].includes(section.id)))) throw Error('Invalid section ID.');
  if (JSON.stringify(value).length > 8_000_000) throw Error('Workspace is too large.');
  if (value.defaultCatalogView !== undefined && !['list','grid'].includes(value.defaultCatalogView)) throw Error('Invalid catalog view.');
  return { ...(value.defaultCatalogView ? {defaultCatalogView:value.defaultCatalogView} : {}), design, planning: validatePlanning(value.planning), favorites: [...new Set(value.favorites)], darkFog: value.darkFog };
}
