import { useMemo, useState } from 'react';
import { pairs, type Catalog } from '../lib/catalog';
import type { DesignData } from '../lib/design';
import { useItemAccess } from './ItemAccess';
import { LogisticsArrow } from './LogisticsArrow';
import { FactoryPlannerIcon } from './FactoryPlannerIcon';

type Match = { key: string; label: string; direction?: 'imports' | 'exports'; entryId?: string; factoryId?: string };

export function LogisticsSearch({ data, catalog }: { data: DesignData; catalog: Catalog }) {
  const [query, setQuery] = useState('');
  const actions = useItemAccess();
  const term = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!term) return [];
    const items = new Map(catalog.items.map(item => [item.id, item]));
    const recipes = new Map(catalog.recipes.map(recipe => [recipe.id, recipe]));
    const matchesText = (text: string) => text.toLowerCase().includes(term);
    return data.sections.filter(section => section.kind === 'planet').flatMap(planet => {
      const system = data.sections.find(section => section.id === planet.parentId)?.name ?? 'Unassigned';
      const matches: Match[] = [];
      for (const direction of ['imports', 'exports'] as const) {
        for (const entry of planet[direction]) {
          const item = items.get(entry.itemId);
          if (item && matchesText(item.name)) matches.push({key: direction + entry.id, label: item.name, direction, entryId: entry.id});
        }
      }
      for (const factory of Object.values(planet.factories ?? {})) {
        const recipe = recipes.get(factory.recipeId);
        const outputNames = (recipe ? pairs(recipe.outputs).map(output => output.id) : [factory.itemId])
          .map(id => items.get(id)?.name).filter((name): name is string => !!name);
        if (matchesText(factory.name) || outputNames.some(matchesText)) {
          matches.push({key: factory.id, label: factory.name, factoryId: factory.id});
        }
      }
      const tags = (planet.specializations ?? []).filter(matchesText);
      const locationMatch = matchesText(planet.name) || matchesText(system) || matchesText(planet.planetType ?? '') || tags.length > 0;
      return locationMatch || matches.length ? [{planet, system, tags, matches}] : [];
    }).sort((a, b) => a.system.localeCompare(b.system) || a.planet.name.localeCompare(b.planet.name));
  }, [data, catalog, term]);

  function open(planetId: string, match?: Match) {
    actions.planet(planetId, match?.entryId, match?.factoryId);
    setQuery('');
  }

  return <div className="logistics-search">
    <div className="logistics-search-field">
      <input type="search" aria-label="Search logistics network" placeholder="Search network…" value={query} onChange={event => setQuery(event.target.value)}/>
      {query && <button type="button" aria-label="Clear network search" onClick={() => setQuery('')}>×</button>}
    </div>
    {term && <div className="logistics-search-results" aria-label="Network search results">
      {!results.length && <p role="status">No matches</p>}
      {results.map(({planet, system, tags, matches}) => <article key={planet.id}>
        <button type="button" className="logistics-search-planet" onClick={() => open(planet.id)}><strong>{planet.name}</strong><small>{system}</small></button>
        {!!tags.length && <small className="logistics-search-tags">{tags.join(' · ')}</small>}
        {matches.map(match => <button type="button" key={match.key} className="logistics-search-match" aria-label={`Open ${match.direction ?? 'factory'} ${match.label} on ${planet.name}`} onClick={() => open(planet.id, match)}>
          {match.direction ? <LogisticsArrow direction={match.direction}/> : <FactoryPlannerIcon/>}<span>{match.label}</span>
        </button>)}
      </article>)}
    </div>}
  </div>;
}
