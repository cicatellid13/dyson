/** Nominal, unproliferated rates. Provenance and layout assumptions: docs/FACTORY_PLANNER.md. */
export type Facility = { id: number; type: string; speed: number };
export const FACILITIES: Facility[] = [
  {id:2303,type:'ASSEMBLE',speed:.75},{id:2304,type:'ASSEMBLE',speed:1},{id:2305,type:'ASSEMBLE',speed:1.5},{id:2318,type:'ASSEMBLE',speed:3},
  {id:2302,type:'SMELT',speed:1},{id:2315,type:'SMELT',speed:2},{id:2319,type:'SMELT',speed:3},
  {id:2309,type:'CHEMICAL',speed:1},{id:2317,type:'CHEMICAL',speed:2},
  {id:2308,type:'REFINE',speed:1},{id:2310,type:'PARTICLE',speed:1},
  {id:2901,type:'RESEARCH',speed:1},{id:2902,type:'RESEARCH',speed:3},
];
export const BELTS = [{id:2001,rate:6},{id:2002,rate:12},{id:2003,rate:30}] as const;
export const SORTERS = [{id:2011,rate:1.5},{id:2012,rate:3},{id:2013,rate:6}] as const;
// A deliberately conservative planning budget, NOT a claim about every building's port maximum.
export const SORTER_BUDGET = 8;
