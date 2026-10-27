/** Small, consistent line symbols for the library categories. */
export function CategoryIcon({ category }: { category: string }) {
  const paths: Record<string, string> = {
    'Factory Planner': 'M3 21V4a1 1 0 0 1 1-1h3v10l6-4v5l8-5v12H3Zm4-4h1m4 0h1m4 0h1',
    'Planning': 'M6 3h13v18H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM8 3v18M11 8h5m-5 4h5m-5 4h3',
    'Natural Resources': 'M12 3 4 9l2 10h12l2-10-8-6ZM4 9l8 4 8-4M12 13v6M8 6l4 7 4-7',
    'Materials': 'm3 9 5-4h11l2 6-5 5H5L3 9Zm0 0h12l6 2M15 9l1 7M5 16v3h11l5-5v-3',
    'Components': 'M8 8h8v8H8V8ZM9 3v5m6-5v5M9 16v5m6-5v5M3 9h5m-5 6h5m8-6h5m-5 6h5',
    'End Products': 'm3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v10M7 5l10 4v5',
    'Logistics': 'M3 7h15m-4-4 4 4-4 4M21 17H6m4-4-4 4 4 4',
    'Production Facilities': 'M3 21V10l6 4V9l6 5V4h4l2 17H3Zm4-3h1m4 0h1m4 0h1',
    'Decorations': 'M12 3v18M3 12h18M6 6l12 12M6 18 18 6M10 3h4m-4 18h4',
    'Turrets': 'M5 21h14l-2-5H7l-2 5Zm7-5v-5M7 11h10V7H7v4Zm10-4 4-4M9 7V5h6v2',
    'Defense': 'm12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6l8-3Zm-4 9 3 3 5-6',
    'Dark Fog': 'M4 8c0-3 4-5 7-3 3-4 8-1 7 3 4 0 5 6 1 7M3 12h9M5 16h11M8 20h12',
    'Science Matrices': 'm12 2 9 5v10l-9 5-9-5V7l9-5Zm0 0v10m-9 5 9-5 9 5M3 7l9 5 9-5M12 12v10',
  };
  return <svg className="category-symbol" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={category === 'Logistics Network' ? 1.8 : 1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{category === 'Logistics Network' ? <><circle cx="12" cy="4.5" r="2.5"/><circle cx="19.5" cy="12" r="2.5"/><circle cx="12" cy="19.5" r="2.5"/><circle cx="4.5" cy="12" r="2.5"/><path d="m10.2 6.3-3.9 3.9M7 12h10m-3.2 5.7 3.9-3.9"/></> : <path d={paths[category] ?? 'M5 5h14v14H5z'}/>}</svg>;
}
