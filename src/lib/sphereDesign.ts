export type SphereDesign = {
  structurePoints: number | null;
  cellPoints: number | null;
  powerGW: number | null;
};

function phaseMinutes(points: number | null, rate: number | null) {
  if (points === null) return null;
  if (points === 0) return 0;
  if (rate === null || rate <= 0) return null;
  const minutes = points / rate;
  return Number.isFinite(minutes) ? minutes : null;
}

export function calculateSphereDesign(design: SphereDesign, rocketsPerMinute: number | null, cellsPerMinute: number | null) {
  const { structurePoints: rockets, cellPoints: sails, powerGW } = design;
  const frameMinutes = phaseMinutes(rockets, rocketsPerMinute);
  const shellMinutes = phaseMinutes(sails, cellsPerMinute);
  const powerPerThousand = powerGW !== null && rockets !== null && rockets > 0 ? powerGW / (rockets / 1_000) : null;
  return {
    rockets,
    sails,
    powerGW,
    frameMinutes,
    shellMinutes,
    overlapMinutes: frameMinutes !== null && shellMinutes !== null ? Math.max(frameMinutes, shellMinutes) : null,
    gwPerThousandRockets: Number.isFinite(powerPerThousand) ? powerPerThousand : null,
  };
}
