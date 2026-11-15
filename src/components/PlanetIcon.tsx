import { useId } from 'react';

// The palette and surface markings come from the approved icon sheet.
const planetIcons = [
  ["Lava", "#672b31", "#ff996d", "M5 10l7 3-2 6 7 2 5 7M12 13l9-4 6 3"],
  ["Aquatica", "#17436b", "#80ddff", "M5 12q5-4 11 0t11 0M5 20q5-4 11 0t11 0"],
  ["Gas Giant A", "#664739", "#f6c28e", "M4 11q10 4 24 0M4 20q10 4 24 0M9 16h5"],
  ["Gas Giant B", "#635665", "#f2cce3", "M5 10q11 7 22 0M5 22q11-7 22 0M13 16h6"],
  ["Ice Giant", "#2c516e", "#b4d9ff", "M6 9l20 8M5 16l20 8M11 7l14 5"],
  ["Sulfuria", "#504a2b", "#e6e87a", "M7 22l7-10 6 10m-9-6 3 2 3-2M21 10q-3-2 0-5"],
  ["Mariterra", "#27556c", "#a5e1a5", "M5 12l6-3 5 4-3 5-6 1m14-2 5 2-2 6-6-1z"],
  ["Oceanic Jungle", "#134f52", "#63e4bc", "M8 21l5-10 5 10m-3 0 6-13 5 13M10 25h13"],
  ["Sakura Ocean", "#553247", "#f3a9cb", "M6 20q5-4 10-1t10-1M9 24q4-2 8 0t6 0", "M12 15c-4-1-4-5-2-5l3 1c3-3 5 1 2 3zM19 13c-2-3 1-6 3-5l1 2c3 1 2 4-1 4z"],
  ["Pandora Swamp", "#314b3b", "#b6df74", "M7 21h19M11 20v-7m0 4-3-2m8 5V8m0 7 4-3m2 8v-5"],
  ["Prairirea", "#365643", "#a1e9a0", "M6 20q6-9 12-4t9 1M8 24q9-6 17-3M10 12l3-2"],
  ["Savanna", "#60532d", "#ffd487", "M5 23h22M16 22v-7m-8 0 3-5h10l3 5z"],
  ["Scorchedia", "#6c492e", "#ffbd79", "M5 21q5-8 11-3t11 1M6 25q6-5 18-2M17 9h5"],
  ["Desolus", "#4c4a4c", "#d9c3b6", "M8 22q-2-3 3-5t7 2-4 5-6-2zM19 11q-1-2 2-3t4 2-3 3-3-2z"],
  ["Gobi", "#624737", "#edbc9b", "M5 22l6-8 4 4 5-7 7 11M12 24h9"],
  ["Cyclonius", "#3c4b50", "#bde0dc", "M23 12c-5-6-15-4-15 3 0 6 9 9 14 4 3-3 0-6-3-6-3 0-4 3-2 4"],
  ["Onyxtopia", "#483861", "#d8a8fa", "M16 6l6 10-6 10-6-10zM10 16h12M16 6v20"],
  ["Crimsonis", "#663840", "#ff9c99", "M6 22l5-10 6 2 4-6 5 14M10 25h12"],
  ["Halitum", "#484c56", "#e8dac6", "M6 18l7-5 11 2 2 5-7 5-10-2zM10 20l8 2 5-3"],
  ["Glacieon", "#31586a", "#c8f4ff", "M5 15l7-7 5 6 4-3 6 6M9 21l5-3 5 4 5-2"],
  ["Icefrostia", "#36546b", "#9feaf2", "M16 7v18m-8-14 16 10M8 21l16-10"],
  ["Geloterra", "#464c60", "#c9d2ec", "M6 13h9l3-3h7M6 20h7l5 3h7M10 9h2"],
  ["Maroonfrost", "#62384f", "#f3bedb", "M5 18l9-6 3-7m-3 7 6 5 7-2m-7 2-3 11"],
] as const;

export const planetTypeChoices = planetIcons.map(([name]) => name);

const legacyTypes = new Map([
  ['ocean', 'Aquatica'],
  ['waterworld', 'Aquatica'],
  ['gas giant', 'Gas Giant A'],
  ['mediterranean', 'Mariterra'],
  ['arid desert', 'Scorchedia'],
  ['ashen gelisol', 'Geloterra'],
  ['barren desert', 'Desolus'],
  ['crystal desert', 'Onyxtopia'],
  ['frozen tundra', 'Icefrostia'],
  ['hurricane stone forest', 'Cyclonius'],
  ['ice field gelisol', 'Glacieon'],
  ['prairie', 'Prairirea'],
  ['red stone', 'Crimsonis'],
  ['rocky salt lake', 'Halitum'],
  ['scarlet ice lake', 'Maroonfrost'],
  ['volcanic ash', 'Sulfuria'],
]);

export function PlanetIcon({ type, size = 18 }: { type?: string; size?: number }) {
  const clip = useId();
  const label = type?.trim().toLowerCase() ?? '';
  const key = legacyTypes.get(label)?.toLowerCase() ?? label;
  const icon = planetIcons.find(([name]) => name.toLowerCase() === key);

  return <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={{ flexShrink: 0 }}>
    {icon ? <>
      <defs><clipPath id={clip}><circle cx="16" cy="16" r="11.3"/></clipPath></defs>
      <circle cx="16" cy="16" r="12" fill={icon[1]} stroke={icon[2]} strokeWidth="1.6"/>
      <g clipPath={`url(#${clip})`}>
        <path d={icon[3]} fill="none" stroke={icon[2]} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"/>
        {icon[4] && <path d={icon[4]} fill={icon[2]}/>}
      </g>
    </> : <g fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="16" cy="16" r="9"/>
      <ellipse cx="16" cy="16" rx="15" ry="4" transform="rotate(-28 16 16)"/>
    </g>}
  </svg>;
}
