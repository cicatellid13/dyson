import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Database } from './database';
import { mergeWorkspace } from './merge';
import { validateWorkspace, type Workspace, type SyncView } from '../../src/lib/workspace';
import type { Catalog } from '../../src/lib/catalog';

type Cache = { base: Workspace; data: Workspace; catalog: Catalog };
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export class Persistence {
  private cache!: Cache;
  private status: SyncView['status'] = 'synced';
  private message = '';
  private writing: Promise<void> = Promise.resolve();
  private syncing: Promise<void> | null = null;
  private timer?: ReturnType<typeof setTimeout>;
  private initialization?: Promise<{ view: SyncView; catalog: Catalog }>;
  constructor(private db: Database, private cachePath: string, private publish: (view: SyncView) => void) {}
  view(): SyncView { return { data: structuredClone(this.cache.data), status: this.status, message: this.message }; }
  private persist() {
    const serialized = JSON.stringify(this.cache);
    this.writing = this.writing.catch(() => {}).then(async () => {
      await mkdir(path.dirname(this.cachePath), { recursive: true });
      await writeFile(this.cachePath + '.tmp', serialized, { mode: 0o600 });
      await rename(this.cachePath + '.tmp', this.cachePath);
    });
    return this.writing;
  }
  async initialize(legacy: Workspace, bundled: Catalog, recovery?: { base: Workspace; data: Workspace }) {
    if (this.initialization) { await this.initialization; if (recovery) { await this.recover(recovery); await this.sync(); } return { view: this.view(), catalog: this.cache.catalog }; }
    this.initialization = this.load(legacy, bundled, recovery).catch(() => { this.initialization = undefined; throw Error('Could not initialize cloud storage. Check your .env and MongoDB network access, then retry. Local data has not been changed.'); });
    return this.initialization;
  }
  private async load(legacy: Workspace, bundled: Catalog, recovery?: { base: Workspace; data: Workspace }) {
    try {
      const saved = JSON.parse(await readFile(this.cachePath, 'utf8')) as Cache;
      this.cache = { base: validateWorkspace(saved.base), data: validateWorkspace(saved.data), catalog: saved.catalog };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    if (!this.cache) {
      await mkdir(path.dirname(this.cachePath), { recursive: true });
      await writeFile(this.cachePath + '.legacy.json', JSON.stringify(legacy), { mode: 0o600, flag: 'wx' }).catch(error => { if (error.code !== 'EEXIST') throw error; });
      const catalog = await this.db.seedCatalog(bundled);
      const remote = await this.db.initializeWorkspace(validateWorkspace(legacy));
      this.cache = { base: remote.data, data: remote.data, catalog };
      await this.persist();
    }
    if (recovery) await this.recover(recovery);
    await this.sync();
    return { view: this.view(), catalog: this.cache.catalog };
  }
  private async recover(recovery: { base: Workspace; data: Workspace }) {
      const base = validateWorkspace(recovery.base), data = validateWorkspace(recovery.data);
      try { this.cache.data = mergeWorkspace(base, data, this.cache.data); }
      catch {
        await writeFile(this.cachePath + `.recovery-${Date.now()}.json`, JSON.stringify(this.cache), { mode: 0o600 });
        this.cache.base = base; this.cache.data = data;
      }
      await this.persist();
  }
  async save(value: unknown, base: unknown) {
    if (!this.cache) throw Error('Storage is not ready.');
    this.cache.data = mergeWorkspace(validateWorkspace(base), validateWorkspace(value), this.cache.data);
    if (this.status !== 'conflict') { this.status = 'pending'; this.message = ''; }
    await this.persist();
    clearTimeout(this.timer);
    if (this.status !== 'conflict') this.timer = setTimeout(() => { void this.sync(); }, 750);
    return this.view();
  }
  async sync(): Promise<void> {
    if (!this.cache || this.status === 'conflict') return;
    if (this.syncing) return this.syncing;
    this.syncing = this.runSync().finally(() => { this.syncing = null; });
    return this.syncing;
  }
  private async runSync() {
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const remote = await this.db.readWorkspace();
        const localAtStart = structuredClone(this.cache.data);
        let merged: Workspace;
        try { merged = mergeWorkspace(this.cache.base, localAtStart, remote.data); }
        catch { this.status = 'conflict'; this.message = 'This device and another machine changed the same data. Your local copy is preserved. Choose which version to keep.'; this.publish(this.view()); return; }
        if (!equal(merged, remote.data) && !await this.db.writeWorkspace(remote.data, merged, remote.revision)) continue;
        // Incorporate edits made while the network write was in flight.
        this.cache.data = mergeWorkspace(localAtStart, this.cache.data, merged);
        this.cache.base = merged;
        this.status = equal(this.cache.data, merged) ? 'synced' : 'pending';
        this.message = '';
        await this.persist();
        this.publish(this.view());
        if (this.status === 'pending') this.timer = setTimeout(() => { void this.sync(); }, 750);
        return;
      }
      throw Error('Concurrent changes');
    } catch {
      this.status = 'offline'; this.message = 'Cloud unavailable. Changes are saved on this device and will retry automatically.';
      this.publish(this.view());
    }
  }
  async resolve(choice: 'local' | 'cloud') {
    if (this.status !== 'conflict') return this.view();
    const remote = await this.db.readWorkspace();
    // Keep a separate recovery copy before either explicit resolution.
    await writeFile(this.cachePath + `.conflict-${Date.now()}.json`, JSON.stringify(this.cache), { mode: 0o600 });
    this.cache.base = remote.data;
    if (choice === 'cloud') this.cache.data = remote.data;
    this.status = 'pending'; this.message = '';
    await this.persist(); await this.sync(); return this.view();
  }
  async close() { clearTimeout(this.timer); await this.writing; await this.sync(); await this.writing; await this.db.close(); }
}
