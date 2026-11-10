import { mkdir,readFile,rename,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Database } from './database';
import { Persistence } from './persistence';
import { emptyWorkspace,type Workspace,type SyncView } from '../../src/lib/workspace';
import { validProfileId,profileName,type ProfileInfo,type ProfileWorkspace } from '../../src/lib/profiles';
import type { Catalog } from '../../src/lib/catalog';

export class Profiles {
  private active?:Persistence;
  private selected='shared';
  private index:ProfileInfo[]=[];
  private selectionLoaded=false;
  private changing=false;
  private registry:Database;
  constructor(envFiles:string[],private directory:string,private catalog:Catalog,private publish:(view:SyncView)=>void,private makeDatabase=(id:string)=>new Database(envFiles,id)){
    this.registry=this.makeDatabase('shared');
  }
  private async write(file:string,value:unknown){
    await mkdir(path.dirname(file),{recursive:true});
    await writeFile(file+'.tmp',JSON.stringify(value),{mode:0o600});await rename(file+'.tmp',file);
  }
  async list(){
    const file=path.join(this.directory,'play-throughs.json');
    try{this.index=await this.registry.listProfiles();await this.write(file,this.index);}
    catch{
      if(!this.index.length){try{const saved=JSON.parse(await readFile(file,'utf8'));if(Array.isArray(saved))this.index=saved.filter(profile=>validProfileId(profile.id)&&typeof profile.name==='string');}catch{/* First use still opens the original workspace offline if cached. */}}
      if(!this.index.length)this.index=[{id:'shared',name:'Current play-through',createdAt:''}];
    }
    if(!this.selectionLoaded){
      try{const id=JSON.parse(await readFile(path.join(this.directory,'active-play-through.json'),'utf8')).id;if(validProfileId(id)&&this.index.some(profile=>profile.id===id))this.selected=id;}catch{/* Original workspace remains the default. */}
      this.selectionLoaded=true;
    }
    return {profileId:this.selected,profiles:this.index};
  }
  private createStorage(id:string){
    const file=id==='shared'?path.join(this.directory,'cloud-workspace.json'):path.join(this.directory,'play-throughs',id,'cloud-workspace.json');
    const storage=new Persistence(this.makeDatabase(id),file,view=>{if(this.active===storage&&this.selected===id)this.publish(view);});
    return storage;
  }
  async initialize(legacy:Workspace,recovery?:{base:Workspace;data:Workspace}):Promise<ProfileWorkspace>{
    if(!this.selectionLoaded)await this.list();
    if(!this.active)this.active=this.createStorage(this.selected);
    const result=await this.active.initialize(this.selected==='shared'?legacy:emptyWorkspace(),this.catalog,recovery);
    return {...result,profileId:this.selected,profiles:this.index};
  }
  async switch(id:unknown,recovery?:{base:Workspace;data:Workspace}):Promise<ProfileWorkspace>{
    if(this.changing)throw Error('A play-through is already opening.');
    if(!validProfileId(id)||!this.index.some(profile=>profile.id===id))throw Error('Play-through not found. Refresh the list and try again.');
    if(id===this.selected)return this.initialize(emptyWorkspace(),recovery);
    this.changing=true;
    let candidate:Persistence|undefined;
    try{
      await this.flush();
      if(this.active?.view().status==='conflict')throw Error('Resolve the workspace conflict before switching play-throughs.');
      candidate=this.createStorage(id);
      const result=await candidate.initialize(emptyWorkspace(),this.catalog,recovery);
      await this.write(path.join(this.directory,'active-play-through.json'),{id});
      const old=this.active;this.active=candidate;this.selected=id;candidate=undefined;
      await old?.close().catch(()=>{});
      return {...result,profileId:this.selected,profiles:this.index};
    }finally{this.changing=false;await candidate?.close().catch(()=>{});}
  }
  async create(name:unknown){
    profileName(name);
    if(this.active?.view().status==='conflict')throw Error('Resolve the workspace conflict before creating a play-through.');
    const profile=await this.registry.createProfile(name);
    await this.list();return this.switch(profile.id);
  }
  async rename(id:unknown,name:unknown){await this.registry.renameProfile(id,name);return this.list();}
  async save(value:unknown,base:unknown){if(this.changing)throw Error('Wait for the play-through to open.');if(!this.active)throw Error('Workspace is not ready.');return this.active.save(value,base);}
  async sync(){await this.active?.sync();}
  async resolve(choice:'local'|'cloud'){if(!this.active)throw Error('Workspace is not ready.');return this.active.resolve(choice);}
  async flush(){await this.active?.flush();}
  async close(){await this.active?.close();await this.registry.close();}
}
