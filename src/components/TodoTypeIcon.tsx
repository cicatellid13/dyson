import type { TodoType } from '../lib/planning';
import { LogisticsArrow } from './LogisticsArrow';

export const todoTypeLabels = {
  all: 'All', import: 'Import', export: 'Export', production: 'Production',
  build: 'Build', power: 'Power', issue: 'Issue', other: 'Other', untyped: 'Untyped',
};

const symbols = { all: '▦', production: '⚙', power: 'ϟ', issue: '!', other: '•••', untyped: '•' };

export function TodoTypeIcon({ type }: { type: TodoType | 'all' | 'untyped' }) {
  if (type === 'import' || type === 'export') {
    return <LogisticsArrow direction={type === 'import' ? 'imports' : 'exports'}/>;
  }
  if (type === 'build') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M7 2h3v3h12v3h-3v5h-3V8h-6v11h4v3H2v-3h5V8H2V5h5z"/>
        <path d="M14 15h7v5h-7z"/>
      </svg>
    );
  }
  return <>{symbols[type]}</>;
}
