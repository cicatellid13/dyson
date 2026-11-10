import { MongoClient } from 'mongodb';
import { config } from 'dotenv';
import { createHash, randomUUID } from 'node:crypto';
import type { Catalog } from '../../src/lib/catalog';
import { encode, decode, workspacePatch, type StoredData } from './merge';
import { emptyWorkspace, type Workspace } from '../../src/lib/workspace';
import { profileName, validProfileId, type ProfileInfo } from '../../src/lib/profiles';

export type WorkspaceDoc = { _id: string; revision: number; data: StoredData; updatedAt: Date };
export class Database {
  private client: MongoClient;
  private databaseName: string;
  constructor(envFiles: string[], private profileId='shared') {
    if(!validProfileId(profileId))throw Error('Invalid play-through.');
    for (const file of envFiles) config({ path: file, quiet: true });
    const uri = process.env.MONGODB_URI;
    if (!uri) throw Error('MongoDB is not configured. Add MONGODB_URI to the app configuration .env file.');
    this.databaseName = process.env.MONGODB_DATABASE || 'dsp_fieldguide';
    if (!/^[a-zA-Z0-9_-]+$/.test(this.databaseName)) throw Error('Invalid database name.');
    this.client = new MongoClient(uri, { maxPoolSize: 3, minPoolSize: 0, serverSelectionTimeoutMS: 8000, connectTimeoutMS: 8000, socketTimeoutMS: 15000 });
  }
  private get db() { return this.client.db(this.databaseName); }
  private async profileRegistry(){
    const collection=this.db.collection<ProfileInfo&{_id:string;nameKey:string}>('workspace_profiles');
    await collection.createIndex({nameKey:1},{unique:true});
    await collection.updateOne({_id:'shared'},{$setOnInsert:{id:'shared',name:'Current play-through',nameKey:'current play-through',createdAt:new Date().toISOString()}},{upsert:true});
    return collection;
  }
  async listProfiles():Promise<ProfileInfo[]> {
    const collection=await this.profileRegistry();
    return (await collection.find({}).sort({createdAt:1,_id:1}).toArray()).map(({id,name,createdAt})=>({id,name,createdAt}));
  }
  async createProfile(value:unknown):Promise<ProfileInfo>{
    const name=profileName(value),collection=await this.profileRegistry(),id=randomUUID();
    const info={id,name,createdAt:new Date().toISOString()};
    try{await collection.insertOne({...info,_id:id,nameKey:name.toLowerCase()});}
    catch(error){if((error as {code?:number}).code===11000)throw Error('A play-through with that name already exists.');throw error;}
    // The original "shared" workspace is never renamed, copied or overwritten.
    await this.db.collection<WorkspaceDoc>('workspace').updateOne({_id:id},{$setOnInsert:{revision:0,data:encode(emptyWorkspace()),updatedAt:new Date()}},{upsert:true});
    return info;
  }
  async renameProfile(id:unknown,value:unknown){
    if(!validProfileId(id))throw Error('Invalid play-through.');
    const name=profileName(value),collection=await this.profileRegistry();
    try{const result=await collection.updateOne({_id:id},{$set:{name,nameKey:name.toLowerCase()}});if(!result.matchedCount)throw Error('Play-through not found.');}
    catch(error){if((error as {code?:number}).code===11000)throw Error('A play-through with that name already exists.');throw error;}
  }
  async seedCatalog(catalog: Catalog): Promise<Catalog> {
    try { await this.db.createCollection('workspace'); } catch (error) { if ((error as { code?: number }).code !== 48) throw error; }
    // _id indexes exist automatically. A single immutable snapshot avoids hundreds of reads.
    const collection = this.db.collection<{ _id: string; catalog: Catalog; hash: string; createdAt: Date }>('wiki_catalog');
    const existing = await collection.findOne({ _id: 'current' });
    if (existing) {
      // Only a newer bundled snapshot can advance shared reference data. Old clients cannot downgrade it.
      if (Date.parse(catalog.downloaded) > Date.parse(existing.catalog.downloaded)) {
        await collection.updateOne({ _id: 'current', hash: existing.hash }, { $set: {
          catalog, hash: createHash('sha256').update(JSON.stringify(catalog)).digest('hex')
        } });
        return (await collection.findOne({ _id: 'current' }))!.catalog;
      }
      return existing.catalog;
    }
    await collection.updateOne({ _id: 'current' }, { $setOnInsert: { catalog, hash: createHash('sha256').update(JSON.stringify(catalog)).digest('hex'), createdAt: new Date() } }, { upsert: true });
    return (await collection.findOne({ _id: 'current' }))!.catalog;
  }
  async initializeWorkspace(legacy: Workspace) {
    const collection = this.db.collection<WorkspaceDoc>('workspace');
    await collection.updateOne({ _id: this.profileId }, { $setOnInsert: { revision: 0, data: encode(this.profileId==='shared'?legacy:emptyWorkspace()), updatedAt: new Date() } }, { upsert: true });
    return this.readWorkspace();
  }
  async readWorkspace() {
    const doc = await this.db.collection<WorkspaceDoc>('workspace').findOne({ _id: this.profileId });
    if (!doc) throw Error('Workspace is missing.');
    return { data: decode(doc.data), revision: doc.revision };
  }
  async writeWorkspace(previous: Workspace, next: Workspace, revision: number): Promise<boolean> {
    const patch = workspacePatch(encode(previous), encode(next));
    if (!Object.keys(patch.set).length && !Object.keys(patch.unset).length) return true;
    const result = await this.db.collection<WorkspaceDoc>('workspace').updateOne({ _id: this.profileId, revision }, {
      $set: { ...patch.set, updatedAt: new Date() }, $inc: { revision: 1 },
      ...(Object.keys(patch.unset).length ? { $unset: patch.unset } : {}),
    });
    return result.matchedCount === 1;
  }
  async close() { await this.client.close(); }
}
