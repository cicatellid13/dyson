import type { Catalog } from './catalog';
import type { SyncView } from './workspace';

export const ORIGINAL_PROFILE_ID='shared';
export type ProfileInfo={id:string;name:string;createdAt:string};
export type ProfileIndex={profileId:string;profiles:ProfileInfo[]};
export type ProfileWorkspace=ProfileIndex&{view:SyncView;catalog:Catalog};
export function validProfileId(id:unknown):id is string {
  return typeof id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(id)&&!['__proto__','constructor','prototype'].includes(id);
}
export function profileName(value:unknown):string {
  if(typeof value!=='string'||!value.trim()||value.trim().length>80)throw Error('Enter a play-through name between 1 and 80 characters.');
  return value.trim();
}
export function profileStorageKey(key:string,id:string):string {
  if(!validProfileId(id))throw Error('Invalid play-through.');
  return id===ORIGINAL_PROFILE_ID?key:`${key}:profile:${id}`;
}
