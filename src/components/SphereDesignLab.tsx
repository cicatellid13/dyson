import { useSessionSelection } from '../lib/sessionExpansion';
import { calculateSphereDesign } from '../lib/sphereDesign';
import './SphereDesignLab.css';

type DesignInput = { name: string; structurePoints: string; cellPoints: string; powerGW: string };
type LabInputs = { designs: [DesignInput, DesignInput]; rocketRate: string; cellRate: string };

const emptyDesign: DesignInput = { name: '', structurePoints: '', cellPoints: '', powerGW: '' };
const emptyLab: LabInputs = { designs: [emptyDesign, emptyDesign], rocketRate: '', cellRate: '' };
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
  const [draft, setDraft] = useSessionSelection('sphere-design-lab');
  const inputs: LabInputs = draft === null ? emptyLab : JSON.parse(draft);
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
    setDraft(JSON.stringify({ ...inputs, designs }));
  }

  return <section className="sphere-design-lab" aria-labelledby="sphere-design-lab-title">
    <header>
      <h1 id="sphere-design-lab-title">Sphere Design Lab</h1>
      <p>Enter the planned point totals for one layer per design from the in-game Dyson Sphere editor.</p>
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
        onChange={event => setDraft(JSON.stringify({ ...inputs, rocketRate: event.target.value }))} /></label>
      <label>Sails absorbed/min<input type="number" min="0" step="any" value={inputs.cellRate} aria-invalid={inputs.cellRate !== '' && readNumber(inputs.cellRate) === null}
        onChange={event => setDraft(JSON.stringify({ ...inputs, cellRate: event.target.value }))} /></label>
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
