import { validateFactories, type SavedFactory } from './savedFactories';
export const DESIGN_KEY = 'dsp-design-v1';
export type TradeEntry = {
  id: string;
  linkId?: string;
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
  factories?: Record<string,SavedFactory>;
  planetType?: string;
  specializations?: string[];
  order?: number;
  imports: TradeEntry[];
  exports: TradeEntry[];
};
export type DesignData = { version: 1; planetTypes?: string[]; specializationTypes?: string[]; sections: DesignSection[] };
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
  for (const key of ['planetTypes','specializationTypes'] as const) {
    const values=data[key];
    if(values!==undefined && (!Array.isArray(values)||values.length>1000||values.some(v=>typeof v!=='string'||!v.trim()||v.length>(key==='planetTypes'?120:40)))) throw Error('Invalid saved planet labels.');
  }
  const ids = new Set<string>();
  for (const s of data.sections) {
    if (!s || typeof s.id !== 'string' || ids.has(s.id) || !['planet', 'system'].includes(s.kind) ||
      typeof s.name !== 'string' || typeof s.notes !== 'string' || (s.parentId !== null && typeof s.parentId !== 'string')) throw Error('Invalid design section.');
    if (s.planetType !== undefined && (typeof s.planetType !== 'string' || s.planetType.length > 120)) throw Error('Invalid planet type.');
    if (s.specializations !== undefined && (!Array.isArray(s.specializations) || s.specializations.length>12 || s.specializations.some(t=>typeof t!=='string'||!t.trim()||t.length>40))) throw Error('Invalid specializations.');
    if (s.order !== undefined && !Number.isFinite(s.order)) throw Error('Invalid section order.');
    validateFactories(s.factories);
    if(s.kind!=='planet'&&s.factories&&Object.keys(s.factories).length)throw Error('Factory plans belong to planets.');
    ids.add(s.id);
    for (const list of [s.imports, s.exports]) {
      if (!Array.isArray(list) || list.some(e => !e || typeof e.id !== 'string' || (e.linkId !== undefined && typeof e.linkId !== 'string') || !Number.isInteger(e.itemId) || typeof e.amount !== 'string' ||
        !['items/min', 'items/s', 'items'].includes(e.unit) || typeof e.destination !== 'string' || (e.planetId !== undefined && e.planetId !== null && typeof e.planetId !== 'string'))) throw Error('Invalid import/export list.');
    }
  }
  for (const s of data.sections) {
    if (s.parentId !== null && (s.kind !== 'planet' || !data.sections.some(parent => parent.id === s.parentId && parent.kind === 'system' && parent.parentId === null))) throw Error('Invalid planet hierarchy.');
  }
  return data;
}

export function orderedSections(sections: DesignSection[]): DesignSection[] {
  return sections.map((section,index) => ({section,index})).sort((a,b) => (a.section.order ?? a.index) - (b.section.order ?? b.index) || a.index-b.index).map(value => value.section);
}
export function reorderSections(data: DesignData, source: string, target: string): DesignData {
  const from = data.sections.find(s => s.id === source), to = data.sections.find(s => s.id === target);
  if (!from || !to || source === target || from.kind !== to.kind || from.parentId !== to.parentId) return data;
  const siblings = orderedSections(data.sections.filter(s => s.kind === from.kind && s.parentId === from.parentId));
  const fromIndex = siblings.findIndex(s => s.id === source), toIndex = siblings.findIndex(s => s.id === target);
  siblings.splice(fromIndex,1); siblings.splice(toIndex,0,from);
  const ranks = new Map(siblings.map((section,index) => [section.id,index]));
  return { ...data, sections:data.sections.map(s => ranks.has(s.id) ? {...s,order:ranks.get(s.id)!} : s) };
}

/** Keep explicitly paired routes in one workspace update, never infer links for legacy entries. */
export function updateTrades(data: DesignData, ownerId: string, direction: 'imports'|'exports', entries: TradeEntry[]): DesignData {
  const owner = data.sections.find(s=>s.id===ownerId);
  if (!owner) return data;
  const opposite = direction==='exports'?'imports':'exports';
  let sections = data.sections.map(s=>s.id===ownerId?{...s,[direction]:entries}:s);
  for (const old of owner[direction]) {
    if (!old.linkId) continue;
    const next = entries.find(e=>e.id===old.id);
    if (next && next.itemId===old.itemId && next.amount===old.amount && next.unit===old.unit && next.planetId===old.planetId && next.linkId===old.linkId) continue;
    const target = sections.find(s=>s.id===next?.planetId && s.kind==='planet' && s.id!==ownerId);
    const partner = data.sections.flatMap(s=>s[opposite]).find(e=>e.linkId===old.linkId);
    sections = sections.map(s=>({...s,[opposite]:s[opposite].filter(e=>e.linkId!==old.linkId)}));
    if (next && target) {
      const mirror: TradeEntry = {...next,id:partner?.id??crypto.randomUUID(),planetId:ownerId,destination:''};
      sections = sections.map(s=>s.id===target.id?{...s,[opposite]:[...s[opposite],mirror]}:s);
    } else if(next) sections=sections.map(s=>s.id===ownerId?{...s,[direction]:s[direction].map(e=>e.id===next.id?{...e,linkId:undefined}:e)}:s);
  }
  return {...data,sections};
}
export function linkExport(data: DesignData, ownerId: string, entryId: string): DesignData {
 return linkRoute(data,ownerId,'exports',entryId);
}
export function linkRoute(data: DesignData, ownerId: string, direction:'imports'|'exports', entryId: string): DesignData {
 const owner=data.sections.find(s=>s.id===ownerId&&s.kind==='planet');
 const entry=owner?.[direction].find(e=>e.id===entryId);
 const target=data.sections.find(s=>s.id===entry?.planetId&&s.kind==='planet');
 if(!owner||!entry||entry.linkId||!target||target.id===owner.id)return data;
 const opposite=direction==='imports'?'exports':'imports';
 const match=target[opposite].find(e=>!e.linkId&&e.itemId===entry.itemId&&e.planetId===owner.id&&e.amount===entry.amount&&e.unit===entry.unit);
 const linkId=crypto.randomUUID();
 return {...data,sections:data.sections.map(s=>s.id===owner.id?{...s,[direction]:s[direction].map(e=>e.id===entryId?{...e,linkId}:e)}:s.id===target.id?{...s,[opposite]:match?s[opposite].map(e=>e.id===match.id?{...e,linkId}:e):[...s[opposite],{...entry,id:crypto.randomUUID(),linkId,planetId:owner.id,destination:''}]}:s)};
}

export function routeReadiness(sections: DesignSection[], ownerId: string | undefined, direction: 'imports'|'exports', entry: TradeEntry) {
  const peer=sections.find(s=>s.id===entry.planetId&&s.kind==='planet'&&s.id!==ownerId);
  if(!peer) return {ready:false,message:`Choose a ${direction==='imports'?'source':'destination'} planet.`};
  const opposite=direction==='imports'?'exports':'imports';
  const ready=peer[opposite].some(e=>e.itemId===entry.itemId&&e.planetId===ownerId);
  return {ready,message:ready?`${peer.name} has the matching ${opposite==='exports'?'export':'import'}.`:`${peer.name} has no matching ${opposite==='exports'?'export to':'import from'} this planet.`};
}

export function removeRouteSide(data:DesignData,ownerId:string,direction:'imports'|'exports',entryId:string):DesignData {
 const entry=data.sections.find(s=>s.id===ownerId)?.[direction].find(e=>e.id===entryId);
 if(!entry)return data;
 const opposite=direction==='imports'?'exports':'imports';
 return {...data,sections:data.sections.map(s=>({...s,[direction]:s.id===ownerId?s[direction].filter(e=>e.id!==entryId):s[direction],[opposite]:entry.linkId?s[opposite].map(e=>{if(e.linkId!==entry.linkId)return e;const {linkId,...unlinked}=e;return unlinked;}):s[opposite]}))};
}

/** Copy a factory requirement into logistics without replacing an existing route. */
export function addFactoryTrade(data:DesignData,planetId:string,direction:'imports'|'exports',itemId:number,perSecond:number):DesignData {
 const planet=data.sections.find(s=>s.id===planetId&&s.kind==='planet');
 if(!planet||planet[direction].some(e=>e.itemId===itemId)||!Number.isInteger(itemId)||!Number.isFinite(perSecond)||perSecond<=0)return data;
 return {...data,sections:data.sections.map(s=>s.id===planetId?{...s,[direction]:[...s[direction],{id:crypto.randomUUID(),itemId,amount:String(Number((perSecond*60).toPrecision(12))),unit:'items/min' as const,destination:'',planetId:null}]}:s)};
}
