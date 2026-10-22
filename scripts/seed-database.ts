import { Database } from '../electron/backend/database';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Catalog } from '../src/lib/catalog';
async function main() {
let db: Database | undefined;
try {
  db = new Database([path.resolve('.env')]);
  const catalog = JSON.parse(await readFile('public/data/catalog.json','utf8')) as Catalog;
  const saved = await db.seedCatalog(catalog);
  if (process.argv.includes('--verify-workspace')) {
    const workspace = await db.readWorkspace();
    console.log(`Workspace verified: ${workspace.data.design.sections.filter(s => s.kind === 'system').length} systems, ${workspace.data.design.sections.filter(s => s.kind === 'planet').length} planets, ${workspace.data.favorites.length} favorites; revision ${workspace.revision}.`);
  }
  console.log(`Wiki seeded: ${saved.items.length} items, ${saved.recipes.length} recipes. Workspace migration occurs on first desktop launch.`);
} catch { console.error('Database seed failed. Check the MongoDB connection and Atlas network access. Credentials were not logged.'); process.exitCode=1; }
finally { await db?.close(); }

}
void main();
