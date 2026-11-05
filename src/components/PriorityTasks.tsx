import { todoTypes, type ChecklistItem } from '../lib/planning';
import { LogisticsArrow } from './LogisticsArrow';

export function priorityTaskSummary(entries: ChecklistItem[] = []) {
  return [...todoTypes, 'untyped' as const].flatMap(type => {
    const tasks = entries.filter(task => (task.type ?? 'untyped') === type);
    if (!tasks.length) return [];
    const completed = tasks.filter(task => task.done).length;
    return [{ type, total: tasks.length, completed }];
  });
}

export function PriorityTasks({ summary }: { summary: ReturnType<typeof priorityTaskSummary> }) {
  const symbols = { production: '⚙', power: 'ϟ', issue: '!', other: '•••', untyped: '•' };
  if (!summary.length) return <>no to do items</>;
  return <div className="priority-task-summary">{summary.map(({ type, total, completed }) =>
    <div className="priority-task-row" key={type} aria-label={`${type}: ${completed} completed, ${total} total`}>
      <span className={`todo-type todo-type-icon priority-task-icon ${type}`} aria-hidden="true"><span>{type === 'import' || type === 'export'
        ? <LogisticsArrow direction={type === 'import' ? 'imports' : 'exports'}/>
        : symbols[type]}</span></span>
      <span aria-hidden="true">{completed}/{total}</span>
    </div>
  )}</div>;
}
