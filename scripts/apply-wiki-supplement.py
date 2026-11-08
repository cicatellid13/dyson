"""Reapply reviewed dsp-wiki.com additions after a Fandom refresh (no network)."""
import copy
import datetime
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]


def apply(catalog, supplement):
    result = copy.deepcopy(catalog)
    items = {item['id']: item for item in result['items']}
    for item in supplement['newItems']:
        if item['id'] not in items:
            added = copy.deepcopy(item)
            result['items'].append(added)
            items[added['id']] = added
    for patch in supplement['gridUpdates'] + supplement['items']:
        if patch['id'] not in items:
            raise ValueError(f"Supplement references missing item {patch['id']}")
        items[patch['id']].update(copy.deepcopy(patch))
    for key in ('recipes', 'techs'):
        existing = {entry['id']: entry for entry in result[key]}
        for entry in supplement[key]:
            # Preserve a refreshed upstream definition when it already exists.
            if entry['id'] not in existing:
                result[key].append(copy.deepcopy(entry))
    result['supplementSources'] = [{key: supplement[key] for key in (
        'source', 'license', 'licenseUrl', 'checked', 'gameDataSource', 'gameDataVersion'
    )}]
    if result != catalog:
        result['downloaded'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    return result


if __name__ == '__main__':
    path = ROOT / 'public/data/catalog.json'
    supplement = json.loads((ROOT / 'scripts/data/dsp-wiki-supplement.json').read_text())
    catalog = apply(json.loads(path.read_text()), supplement)
    temporary = path.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(catalog, ensure_ascii=False, separators=(',', ':')))
    temporary.replace(path)
    print(f"Applied reviewed DSP Wiki additions: {len(catalog['items'])} items, {len(catalog['recipes'])} recipes.")
