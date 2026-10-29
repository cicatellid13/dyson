import {validateWorkspace,type Workspace} from './workspace';
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const records=(v:unknown[]):v is {id:string}[]=>v.every(x=>object(x)&&typeof x.id==='string');
/** Reverse only the removal's delta; never roll back unrelated subsequent edits. */
function reverse(before:unknown,after:unknown,current:unknown):unknown{
 if(same(before,after))return current;
 if(same(after,current)||same(before,current))return before;
 if(Array.isArray(before)&&Array.isArray(after)&&Array.isArray(current)&&records(before)&&records(after)&&records(current)){
  const out=current.map(x=>reverse(before.find(v=>v.id===x.id),after.find(v=>v.id===x.id),x) as {id:string}).filter(Boolean);
  before.forEach((x,index)=>{if(!after.some(y=>y.id===x.id)&&!current.some(y=>y.id===x.id))out.splice(Math.min(index,out.length),0,x);});
  for(const x of after)if(before.some(y=>y.id===x.id)&&!current.some(y=>y.id===x.id)&&!same(x,before.find(y=>y.id===x.id)))throw Error('An affected record was removed after this action.');
  return out;
 }
 if(object(before)&&object(after)&&object(current)){
  const out:Record<string,unknown>={};for(const key of new Set([...Object.keys(before),...Object.keys(after),...Object.keys(current)])){const v=reverse(before[key],after[key],current[key]);if(v!==undefined)out[key]=v;}return out;
 }
 throw Error('An affected record has changed since removal. Undo would overwrite newer changes.');
}
export function restoreRemoval(before:Workspace,after:Workspace,current:Workspace):Workspace{
 const favorites=[...current.favorites];before.favorites.forEach((id,index)=>{if(!after.favorites.includes(id)&&!favorites.includes(id))favorites.splice(Math.min(index,favorites.length),0,id);});
 const result=reverse({...before,favorites:[]},{...after,favorites:[]},{...current,favorites:[]}) as Workspace;
 return validateWorkspace({...result,favorites});
}
export function removalLabel(a:Workspace,b:Workspace):string|null{
 const section=a.design.sections.find(s=>!b.design.sections.some(t=>t.id===s.id));if(section)return section.kind==='planet'?'Planet removed':'System removed';
 if(a.planning.notes.some(n=>!b.planning.notes.some(t=>t.id===n.id))||a.planning.folders.some(n=>!b.planning.folders.some(t=>t.id===n.id)))return 'Note or folder removed';
 for(const s of a.design.sections){const next=b.design.sections.find(t=>t.id===s.id);if(!next)continue;
 if(Object.keys(s.factories??{}).some(id=>!next.factories?.[id]))return 'Factory removed';
 for(const direction of ['imports','exports'] as const)if(s[direction].some(e=>!next[direction].some(t=>t.id===e.id)))return direction==='imports'?'Import removed':'Export removed';}
 return a.favorites.some(id=>!b.favorites.includes(id))?'Favorite removed':null;
}
