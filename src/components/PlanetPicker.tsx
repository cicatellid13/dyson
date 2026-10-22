import { useState } from 'react';
import type { DesignSection } from '../lib/design';

const STANDALONE = '__standalone__';
export function PlanetPicker({ sections, planetId, legacyName, label, direction, onChange }: {
  sections: DesignSection[]; planetId?: string | null; legacyName: string;
  label: string; direction: 'From' | 'To'; onChange: (id: string | null) => void;
}) {
  const planets = sections.filter(section => section.kind === 'planet');
  const selected = planets.find(planet => planet.id === planetId);
  const [group, setGroup] = useState(selected ? selected.parentId ?? STANDALONE : '');
  const selectedGroup = selected ? selected.parentId ?? STANDALONE : group;
  const systems = sections.filter(section => section.kind === 'system').sort((a,b) => a.name.localeCompare(b.name));
  const choices = planets.filter(planet => (planet.parentId ?? STANDALONE) === selectedGroup).sort((a,b) => a.name.localeCompare(b.name));
  return <fieldset className="planet-picker">
    <legend>{direction}</legend>
    <label>System<select aria-label={`${label} ${direction.toLowerCase()} system`} value={selectedGroup} onChange={event => { setGroup(event.target.value); onChange(null); }}>
      <option value="">Select a system</option>
      {systems.map(system => <option key={system.id} value={system.id}>{system.name || 'Unnamed system'}</option>)}
      {planets.some(planet => planet.parentId === null) && <option value={STANDALONE}>Standalone planets</option>}
    </select></label>
    <label>Planet<select aria-label={`${label} ${direction.toLowerCase()} planet`} value={selected?.id ?? ''} disabled={!selectedGroup || !choices.length} onChange={event => onChange(event.target.value || null)}>
      <option value="">{selectedGroup && !choices.length ? 'No planets in this system' : 'Select a planet'}</option>
      {choices.map(planet => <option key={planet.id} value={planet.id}>{planet.name || 'Unnamed planet'}</option>)}
    </select></label>
    {!planets.length && <p className="design-empty-small">Create a planet in Logistics Network to connect this route.</p>}
    {planetId && !selected && <p className="design-warning">The previously selected planet was deleted. Choose another planet.</p>}
    {!planetId && legacyName && <p className="design-empty-small">Previous entry: {legacyName}. Select a created planet to connect it.</p>}
  </fieldset>;
}
