import { useCallback, useSyncExternalStore, type SetStateAction } from 'react';

let profileScope='shared';
export function setSessionProfile(id:string){profileScope=id;}

// Renderer memory only: survives navigation, never written to disk or MongoDB.
const groups = new Map<string, Set<string>>();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
function snapshot(key: string) {
  if (!groups.has(key)) groups.set(key, new Set());
  return groups.get(key)!;
}
export function useSessionExpansion(key: string) {
  key=`${profileScope}:${key}`;
  const read = useCallback(() => snapshot(key), [key]);
  const expanded = useSyncExternalStore(subscribe, read, read);
  const setExpanded = useCallback((action: SetStateAction<Set<string>>) => {
    const previous = snapshot(key);
    const next = typeof action === 'function' ? action(previous) : action;
    groups.set(key, next);
    listeners.forEach(listener => listener());
  }, [key]);
  return [expanded, setExpanded] as const;
}

const selections = new Map<string, string | null>();
export function useSessionSelection(key: string, initial: string | null = null) {
  key=`${profileScope}:${key}`;
  const read = useCallback(() => selections.has(key) ? selections.get(key)! : initial, [key, initial]);
  const selected = useSyncExternalStore(subscribe, read, read);
  const setSelected = useCallback((action: SetStateAction<string | null>) => {
    const previous = selections.has(key) ? selections.get(key)! : initial;
    selections.set(key, typeof action === 'function' ? action(previous) : action);
    listeners.forEach(listener => listener());
  }, [key, initial]);
  return [selected, setSelected] as const;
}
