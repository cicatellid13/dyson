import type { DesignSection } from './design';
export function logisticsRoutes(planets: DesignSection[], visibleItems: Set<number>) {
 const ids = new Set(planets.map(p=>p.id));
 const routes = new Map<string,{from:string;to:string;items:number[]}>();
 for (const planet of planets) for (const direction of ['imports','exports'] as const) for (const entry of planet[direction]) {
  if (!entry.planetId || !ids.has(entry.planetId) || entry.planetId===planet.id || !visibleItems.has(entry.itemId)) continue;
  const from=direction==='imports'?entry.planetId:planet.id, to=direction==='imports'?planet.id:entry.planetId;
  const key=JSON.stringify([from,to]); const route=routes.get(key)??{from,to,items:[]};
  if(!route.items.includes(entry.itemId))route.items.push(entry.itemId);
  routes.set(key,route);
 }
 return [...routes.values()];
}
