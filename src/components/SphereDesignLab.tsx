import { useState } from 'react';
import { useWorkspace } from '../lib/persistence';
import { profileStorageKey } from '../lib/profiles';
import { calculateSphereDesign } from '../lib/sphereDesign';
import './SphereDesignLab.css';

type DesignInput = { name: string; structurePoints: string; cellPoints: string; powerGW: string };
type LabInputs = { designs: [DesignInput, DesignInput]; rocketRate: string; cellRate: string };

const emptyDesign: DesignInput = { name: '', structurePoints: '', cellPoints: '', powerGW: '' };
const emptyLab: LabInputs = { designs: [emptyDesign, emptyDesign], rocketRate: '', cellRate: '' };
function loadLabInputs(key: string): LabInputs {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? 'null') as Partial<LabInputs> | null;
    if (!saved || !Array.isArray(saved.designs) || saved.designs.length !== 2) return emptyLab;
    const [first, second] = saved.designs;
    const restoreDesign = (design: Partial<DesignInput> | null): DesignInput => ({
      name: typeof design?.name === 'string' ? design.name : '',
      structurePoints: typeof design?.structurePoints === 'string' ? design.structurePoints : '',
      cellPoints: typeof design?.cellPoints === 'string' ? design.cellPoints : '',
      powerGW: typeof design?.powerGW === 'string' ? design.powerGW : '',
    });
    return {
      designs: [restoreDesign(first), restoreDesign(second)],
      rocketRate: typeof saved.rocketRate === 'string' ? saved.rocketRate : '',
      cellRate: typeof saved.cellRate === 'string' ? saved.cellRate : '',
    };
  } catch {
    return emptyLab;
  }
}

const designFields = [
  { key: 'structurePoints', label: 'Structure points', whole: true },
  { key: 'cellPoints', label: 'Cell points', whole: true },
  { key: 'powerGW', label: 'Expected power (GW)', whole: false },
] as const;

function readNumber(value: string, whole = false) {
  const parsed = Number(value);
  return value === '' || !Number.isFinite(parsed) || parsed < 0 || (whole && !Number.isSafeInteger(parsed)) ? null : parsed;
}

const numbers = new Intl.NumberFormat(undefined, { maximumSignificantDigits: 8 });
function quantity(value: number, unit = '') {
  return numbers.format(value) + unit;
}

const days = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
function duration(minutes: number) {
  if (minutes === 0) return '0 min';
  if (minutes < 1) return '<1 min';
  if (minutes >= 1440) return `${days.format(minutes / 1440)} days`;
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return hours ? `${hours} h${remainder ? ` ${remainder} min` : ''}` : `${remainder} min`;
}

export function SphereDesignLab() {
  const { profileId } = useWorkspace();
  const storageKey = profileStorageKey('dsp-sphere-design-lab-v1', profileId);
  const [inputs, setInputs] = useState(() => loadLabInputs(storageKey));
  const [saveFailed, setSaveFailed] = useState(false);

  function saveInputs(next: LabInputs) {
    setInputs(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setSaveFailed(false);
    } catch {
      setSaveFailed(true);
    }
  }
  const names = inputs.designs.map((design, index) => design.name.trim() || (index === 0 ? 'Design A' : 'Design B'));
  const results = inputs.designs.map(design => calculateSphereDesign({
    structurePoints: readNumber(design.structurePoints, true),
    cellPoints: readNumber(design.cellPoints, true),
    powerGW: readNumber(design.powerGW),
  }, readNumber(inputs.rocketRate), readNumber(inputs.cellRate)));
  const rows = [
    { label: 'Small Carrier Rockets', key: 'rockets', format: quantity },
    { label: 'Solar Sails', key: 'sails', format: quantity },
    { label: 'Expected power', key: 'powerGW', format: (n: number) => quantity(n, ' GW') },
    { label: 'GW per 1,000 rockets', key: 'gwPerThousandRockets', format: quantity },
    { label: 'Frame time', key: 'frameMinutes', format: duration },
    { label: 'Shell fill time', key: 'shellMinutes', format: duration },
    { label: 'Best-case build time', key: 'overlapMinutes', format: duration },
  ] as const;

  function changeDesign(index: number, field: keyof DesignInput, value: string) {
    const designs: LabInputs['designs'] = [...inputs.designs];
    designs[index] = { ...designs[index], [field]: value };
    saveInputs({ ...inputs, designs });
  }

  return <section className="sphere-design-lab" aria-labelledby="sphere-design-lab-title">
    <header>
      <h1 id="sphere-design-lab-title">Sphere Design Lab</h1>
      <p>Enter the planned point totals for one layer per design from the in-game Dyson Sphere editor.</p>
      {saveFailed && <p role="alert">Your changes could not be saved on this device.</p>}
    </header>

    <div className="sphere-design-inputs">
      {inputs.designs.map((design, index) => <fieldset key={index}>
        <legend>{index === 0 ? 'Design A' : 'Design B'}</legend>
        <label>Design name<input value={design.name} maxLength={60} placeholder="Optional" onChange={event => changeDesign(index, 'name', event.target.value)} /></label>
        {designFields.map(({ key, label, whole }) => <label key={key}>{label}
          <input type="number" min="0" step={whole ? 1 : 'any'} placeholder={key === 'powerGW' ? 'Optional' : undefined} value={design[key]}
            aria-invalid={design[key] !== '' && readNumber(design[key], whole) === null}
            onChange={event => changeDesign(index, key, event.target.value)} />
        </label>)}
      </fieldset>)}
    </div>

    <fieldset className="sphere-design-rates">
      <legend>Shared build rates</legend>
      <label>Rockets launched/min<input type="number" min="0" step="any" value={inputs.rocketRate} aria-invalid={inputs.rocketRate !== '' && readNumber(inputs.rocketRate) === null}
        onChange={event => saveInputs({ ...inputs, rocketRate: event.target.value })} /></label>
      <label>Sails absorbed/min<input type="number" min="0" step="any" value={inputs.cellRate} aria-invalid={inputs.cellRate !== '' && readNumber(inputs.cellRate) === null}
        onChange={event => saveInputs({ ...inputs, cellRate: event.target.value })} /></label>
    </fieldset>

    <div className="sphere-design-results">
      <table>
        <caption>Design comparison</caption>
        <thead><tr><th scope="col">Metric</th>{names.map((name, index) => <th scope="col" key={index}>{name}</th>)}</tr></thead>
        <tbody>{rows.map(({ label, key, format }) => <tr key={key}>
          <th scope="row">{label}</th>
          {results.map((result, index) => <td key={index}>{result[key] === null ? '—' : format(result[key])}</td>)}
        </tr>)}</tbody>
      </table>
      <p>Best-case time assumes the frame and shell fill can run in parallel at the entered rates. Actual construction can take longer while the frame is being built. Sail totals count the sails incorporated into the shell.</p>
    </div>
  </section>;
}
