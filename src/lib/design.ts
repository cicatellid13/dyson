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
  planetIds?: string[];
  systemIds?: string[];
  links?: Record<string,string>;
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
      if(Array.isArray(list))for(const e of list){
        for(const key of ['planetIds','systemIds'] as const)if(e?.[key]!==undefined&&(!Array.isArray(e[key])||e[key]!.length>1000||e[key]!.some(id=>typeof id!=='string')))throw Error('Invalid route selection.');
        if(e?.links!==undefined&&(!e.links||typeof e.links!=='object'||Array.isArray(e.links)||Object.entries(e.links).some(([id,link])=>!id||['__proto__','constructor','prototype'].includes(id)||typeof link!=='string')))throw Error('Invalid route links.');
      }
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

export const routePlanets=(entry:TradeEntry):string[]=>[...new Set(entry.planetIds??(entry.planetId?[entry.planetId]:[]))];
export const routeLinks=(entry:TradeEntry):Record<string,string>=>entry.links??(entry.linkId&&entry.planetId?{[entry.planetId]:entry.linkId}:{});
function selections(entry:TradeEntry,ids:string[],links:Record<string,string>):TradeEntry {return {...entry,planetIds:ids,planetId:ids[0]??null,links,linkId:Object.values(links)[0]};}
export function updateTrades(data:DesignData,ownerId:string,direction:'imports'|'exports',entries:TradeEntry[]):DesignData {
 const owner=data.sections.find(s=>s.id===ownerId);if(!owner)return data;
 const opposite=direction==='imports'?'exports':'imports';
 let sections=data.sections.map(s=>s.id===ownerId?{...s,[direction]:entries}:s);
 for(const old of owner[direction]){
  let next=entries.find(e=>e.id===old.id);
  // Older callers still update the singular field.
  if(next&&next.planetId!==old.planetId&&next.planetIds===old.planetIds)next={...next,planetIds:next.planetId?[next.planetId]:[]};
  const ids=next?routePlanets(next).filter(id=>id!==ownerId&&sections.some(s=>s.id===id&&s.kind==='planet')):[];
  const links={...routeLinks(old)};
  for(const [peerId,link] of Object.entries(links)){
   const keep=!!next&&ids.includes(peerId);
   sections=sections.map(s=>s.id!==peerId?s:{...s,[opposite]:s[opposite].flatMap(peer=>{
    if(!Object.values(routeLinks(peer)).includes(link))return [peer];
    if(keep)return [{...peer,itemId:next!.itemId,amount:next!.amount,unit:next!.unit}];
    const peerLinks={...routeLinks(peer)};delete peerLinks[ownerId];const peerIds=routePlanets(peer).filter(id=>id!==ownerId);
    return peerIds.length?[selections(peer,peerIds,peerLinks)]:[];
   })});
   if(!keep)delete links[peerId];
  }
  if(next){const normalized=selections(next,ids,links);sections=sections.map(s=>s.id===ownerId?{...s,[direction]:s[direction].map(e=>e.id===old.id?normalized:e)}:s);}
 }
 // A shared row's quantity describes each linked route; edits propagate through its links.
 for(const old of owner[direction]){
  const next=entries.find(e=>e.id===old.id);
  if(!next||(next.amount===old.amount&&next.unit===old.unit&&next.itemId===old.itemId))continue;
  const pending=[...Object.values(routeLinks(old))],seen=new Set<string>();
  while(pending.length){const link=pending.pop()!;if(seen.has(link))continue;seen.add(link);
   sections=sections.map(s=>{const updated={...s};for(const side of ['imports','exports'] as const)updated[side]=s[side].map(e=>{const edges=Object.values(routeLinks(e));if(!edges.includes(link))return e;pending.push(...edges.filter(id=>!seen.has(id)));return {...e,itemId:next.itemId,amount:next.amount,unit:next.unit};});return updated;});
  }
 }
 let result={...data,sections};
 // Adding peers to an already-linked row keeps automatic linking active.
 for(const old of owner[direction])if(Object.keys(routeLinks(old)).length&&entries.some(e=>e.id===old.id))result=linkRoute(result,ownerId,direction,old.id);
 return result;
}
export function linkExport(data:DesignData,ownerId:string,entryId:string):DesignData{return linkRoute(data,ownerId,'exports',entryId);}
export function linkRoute(data:DesignData,ownerId:string,direction:'imports'|'exports',entryId:string):DesignData {
 const owner=data.sections.find(s=>s.id===ownerId&&s.kind==='planet');const entry=owner?.[direction].find(e=>e.id===entryId);if(!owner||!entry)return data;
 const opposite=direction==='imports'?'exports':'imports';const links={...routeLinks(entry)};let sections=data.sections;
 for(const peerId of routePlanets(entry)){
  const peer=sections.find(s=>s.id===peerId&&s.kind==='planet'&&s.id!==ownerId);if(!peer||links[peerId])continue;
  const match=peer[opposite].find(e=>e.itemId===entry.itemId&&routePlanets(e).includes(ownerId)&&!routeLinks(e)[ownerId]&&e.amount===entry.amount&&e.unit===entry.unit);
  const link=crypto.randomUUID();links[peerId]=link;
  const mirror=match?selections(match,routePlanets(match),{...routeLinks(match),[ownerId]:link}):selections({...entry,id:crypto.randomUUID(),destination:'',systemIds:owner.parentId?[owner.parentId]:[]},[ownerId],{[ownerId]:link});
  sections=sections.map(s=>s.id===peerId?{...s,[opposite]:match?s[opposite].map(e=>e.id===match.id?mirror:e):[...s[opposite],mirror]}:s);
 }
 return {...data,sections:sections.map(s=>s.id===ownerId?{...s,[direction]:s[direction].map(e=>e.id===entryId?selections(e,routePlanets(e),links):e)}:s)};
}
export function routeReadiness(sections:DesignSection[],ownerId:string|undefined,direction:'imports'|'exports',entry:TradeEntry){
 const ids=routePlanets(entry),opposite=direction==='imports'?'exports':'imports';
 if(!ids.length)return {ready:false,message:`Choose a ${direction==='imports'?'source':'destination'} planet.`};
 const missing=ids.filter(id=>{const peer=sections.find(s=>s.id===id&&s.kind==='planet'&&s.id!==ownerId);return !peer||!peer[opposite].some(e=>e.itemId===entry.itemId&&routePlanets(e).includes(ownerId??''));});
 return {ready:!missing.length,message:missing.length?`${missing.map(id=>sections.find(s=>s.id===id)?.name??'Deleted planet').join(', ')}: no matching ${opposite==='exports'?'export':'import'}.`:'All selected planets have matching routes.'};
}
export function removeRouteSide(data:DesignData,ownerId:string,direction:'imports'|'exports',entryId:string):DesignData {
 const entry=data.sections.find(s=>s.id===ownerId)?.[direction].find(e=>e.id===entryId);if(!entry)return data;
 const opposite=direction==='imports'?'exports':'imports',removed=new Set(Object.values(routeLinks(entry)));
 return {...data,sections:data.sections.map(s=>({...s,[direction]:s.id===ownerId?s[direction].filter(e=>e.id!==entryId):s[direction],[opposite]:s[opposite].map(e=>{const links=Object.fromEntries(Object.entries(routeLinks(e)).filter(([,link])=>!removed.has(link)));return selections(e,routePlanets(e),links);})}))};
}

/** Copy a factory requirement into logistics without replacing an existing route. */
export function addFactoryTrade(data:DesignData,planetId:string,direction:'imports'|'exports',itemId:number,perSecond:number):DesignData {
 const planet=data.sections.find(s=>s.id===planetId&&s.kind==='planet');
 if(!planet||planet[direction].some(e=>e.itemId===itemId)||!Number.isInteger(itemId)||!Number.isFinite(perSecond)||perSecond<=0)return data;
 return {...data,sections:data.sections.map(s=>s.id===planetId?{...s,[direction]:[...s[direction],{id:crypto.randomUUID(),itemId,amount:String(Number((perSecond*60).toPrecision(12))),unit:'items/min' as const,destination:'',planetId:null}]}:s)};
}
