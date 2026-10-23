export function LogisticsArrow({ direction }: { direction: 'imports' | 'exports' }) {
  return <svg className={`logistics-arrow ${direction}`} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 12h18m-6-6 6 6-6 6"/></svg>;
}
