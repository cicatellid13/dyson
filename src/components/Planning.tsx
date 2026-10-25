import { ThemedSelect } from './ThemedSelect';
import { useState } from 'react';
import { useWorkspace, updateWorkspace } from '../lib/persistence';
import { removePlanningFolder, ordered, reorderPlanning, nextScratchTitle, nextOrder, type PlanningData, type PlanningNote } from '../lib/planning';
import { AutoTextarea } from './AutoTextarea';
import '../styles/design.css';
import '../styles/planning.css';

function PlanningIcon({ folder = false }: { folder?: boolean }) {
  return <svg className="planning-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{folder ? <path d="M3 7V5a1 1 0 0 1 1-1h6l2 3h8a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/> : <><path d="M14 3H5v18h14V8Z M14 3v5h5"/><path d="M8 12h8M8 16h6"/></>}</svg>;
}
export function Planning() {
  const cloud = useWorkspace();
  const data = cloud.view.data.planning;
  const [noteId, setNoteId] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [deleting, setDeleting] = useState<{ kind: 'folder' | 'note'; id: string } | null>(null);
  const [undo, setUndo] = useState<{ data: PlanningData; label: string } | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState<{kind: 'folder' | 'note'; id: string} | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  function expand(id: string) { setExpanded(current => new Set([...current, id])); }
  function dragProps(kind: 'folder' | 'note', id: string) {
    return {
      draggable: true,
      onDragStart: (event: React.DragEvent) => { event.stopPropagation(); setDragging({kind,id}); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', id); },
      onDragOver: (event: React.DragEvent) => {
        if (!dragging || dragging.kind !== kind || dragging.id === id) return;
        if (kind === 'note' && data.notes.find(n => n.id === dragging.id)?.folderId !== data.notes.find(n => n.id === id)?.folderId) return;
        event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'move'; setDropTarget(id);
      },
      onDrop: (event: React.DragEvent) => { event.preventDefault(); event.stopPropagation(); if (dragging?.kind === kind) commit(value => reorderPlanning(value, kind, dragging.id, id)); setDragging(null); setDropTarget(null); },
      onDragEnd: () => { setDragging(null); setDropTarget(null); },
    };
  }
  const active = data.notes.find(note => note.id === noteId);
  const folder = data.folders.find(entry => entry.id === folderId);
  const currentFolderId = folder?.id ?? null;

  function commit(change: (value: PlanningData) => PlanningData) {
    updateWorkspace(current => ({ ...current, planning: change(current.planning) }));
  }
  function openNote(note: PlanningNote) { setNoteId(note.id); setFolderId(note.folderId); setDeleting(null); }
  function addNote() {
    const note: PlanningNote = { id: crypto.randomUUID(), folderId: currentFolderId, title: currentFolderId === null ? nextScratchTitle(data.notes) : '', body: '', order: nextOrder(data.notes.filter(n => n.folderId === currentFolderId)) };
    commit(value => ({ ...value, notes: [...value.notes, note] }));
    expand(currentFolderId ?? 'scratch-pad');
    setNoteId(note.id); setDeleting(null); setUndo(null);
  }
  function patch(changes: Partial<PlanningNote>) {
    if (!active) return;
    commit(value => ({ ...value, notes: value.notes.map(note => note.id === active.id ? { ...note, ...changes } : note) }));
  }
  function addFolder(event: React.FormEvent) {
    event.preventDefault();
    if (!folderName.trim()) return;
    const entry = { id: crypto.randomUUID(), name: folderName.trim(), order: nextOrder(data.folders) };
    commit(value => ({ ...value, folders: [...value.folders, entry] }));
    setFolderId(entry.id); setNoteId(null); setCreatingFolder(false); setFolderName(''); setDeleting(null); setUndo(null);
  }
  function remove() {
    if (!deleting) return;
    const target = deleting;
    const removed: PlanningData = target.kind === 'folder'
      ? { folders: data.folders.filter(f => f.id === target.id), notes: data.notes.filter(n => n.folderId === target.id) }
      : { folders: [], notes: data.notes.filter(n => n.id === target.id) };
    commit(value => target.kind === 'folder' ? removePlanningFolder(value, target.id) : { ...value, notes: value.notes.filter(n => n.id !== target.id) });
    setUndo({ data: removed, label: target.kind === 'folder' ? 'Folder removed.' : 'Note removed.' });
    if (target.kind === 'folder') setFolderId(null);
    if (removed.notes.some(n => n.id === noteId)) setNoteId(null);
    setDeleting(null);
  }
  function restore() {
    if (!undo) return;
    commit(value => {
      const folders = [...value.folders, ...undo.data.folders.filter(f => !value.folders.some(current => current.id === f.id))];
      const notes = [...value.notes, ...undo.data.notes.filter(n => !value.notes.some(current => current.id === n.id)).map(n => ({ ...n, folderId: folders.some(f => f.id === n.folderId) ? n.folderId : null }))];
      return { folders, notes };
    });
    setUndo(null);
  }
  function noteButton(note: PlanningNote) {
    return <button key={note.id} className={`planning-note-link ${active?.id === note.id ? 'active' : ''} ${dropTarget === note.id ? 'drop-target' : ''}`} {...dragProps('note', note.id)} onClick={() => openNote(note)}><PlanningIcon/><span>{note.title.trim() || 'Untitled note'}</span></button>;
  }
  const deleteName = deleting?.kind === 'folder' ? data.folders.find(f => f.id === deleting.id)?.name : data.notes.find(n => n.id === deleting?.id)?.title;
  return <div className="design-workspace planning-workspace">
    <aside className="design-locations">
      <div className="design-section-heading"><h2>Planning</h2><span>{data.notes.length} {data.notes.length === 1 ? 'note' : 'notes'}</span></div>
      <p className="design-intro">Ideas, plans, and things to remember.</p>
      <div className="design-create-buttons"><button className="design-button" onClick={addNote}>+ {currentFolderId ? 'Note' : 'Scratch'}</button><button className="design-button" onClick={() => setCreatingFolder(true)}>+ Folder</button></div>
      {creatingFolder && <form className="design-create-form" onSubmit={addFolder}><label>Folder name<input autoFocus aria-label="New folder name" value={folderName} maxLength={120} onChange={e => setFolderName(e.target.value)}/></label><div><button className="design-button" disabled={!folderName.trim()}>Create folder</button><button type="button" onClick={() => setCreatingFolder(false)}>Cancel</button></div></form>}
      <nav aria-label="Planning folders and notes">
        <button className={`planning-folder-link ${currentFolderId === null ? 'active' : ''}`} aria-expanded={expanded.has('scratch-pad')} onClick={() => { setFolderId(null); setNoteId(null); setDeleting(null); setExpanded(current => { const next = new Set(current); if (next.has('scratch-pad')) next.delete('scratch-pad'); else next.add('scratch-pad'); return next; }); }}><span className="planning-chevron" aria-hidden="true">{expanded.has('scratch-pad') ? '▾' : '▸'}</span><PlanningIcon/>Scratch pad<small>{data.notes.filter(n => n.folderId === null).length}</small></button>
        {expanded.has('scratch-pad') && ordered(data.notes.filter(note => note.folderId === null)).map(noteButton)}
        {ordered(data.folders).map(entry => <div key={entry.id} className="planning-folder-group"><button className={`planning-folder-link ${currentFolderId === entry.id ? 'active' : ''} ${dropTarget === entry.id ? 'drop-target' : ''}`} {...dragProps('folder', entry.id)} aria-expanded={expanded.has(entry.id)} onClick={() => { setFolderId(entry.id); setNoteId(null); setDeleting(null); setExpanded(current => { const next = new Set(current); if (next.has(entry.id)) next.delete(entry.id); else next.add(entry.id); return next; }); }}><span className="planning-chevron" aria-hidden="true">{expanded.has(entry.id) ? '▾' : '▸'}</span><PlanningIcon folder/><span>{entry.name.trim() || 'Untitled folder'}</span><small>{data.notes.filter(n => n.folderId === entry.id).length}</small></button>{expanded.has(entry.id) && ordered(data.notes.filter(note => note.folderId === entry.id)).map(noteButton)}</div>)}
      </nav>
    </aside>
    <section className="design-editor planning-editor" aria-label="Planning notepad">
      {undo && <div className="design-undo" role="status">{undo.label}<button onClick={restore}>Undo</button><button aria-label="Dismiss undo" onClick={() => setUndo(null)}>×</button></div>}
      {deleting && <div className="planning-delete-confirm" role="alert"><p>Delete {deleting.kind} “{deleteName?.trim() || `Untitled ${deleting.kind}`}”{deleting.kind === 'folder' ? ' and all notes inside it' : ''}?</p><button className="design-button danger" onClick={remove}>Delete {deleting.kind}</button><button onClick={() => setDeleting(null)}>Cancel</button></div>}
      {active ? <div key={active.id} className="planning-page">
        <div className="planning-toolbar"><label>Folder<ThemedSelect aria-label="Note folder" value={active.folderId ?? ''} onChange={event => { const id = event.target.value || null; patch({ folderId: id, order: nextOrder(data.notes.filter(n => n.folderId === id)) }); setFolderId(id); expand(id ?? 'scratch-pad'); }}><option value="">Scratch pad</option>{ordered(data.folders).map(f => <option key={f.id} value={f.id}>{f.name || 'Untitled folder'}</option>)}</ThemedSelect></label><button className="design-remove" onClick={() => setDeleting({kind:'note',id:active.id})}>Delete note</button></div>
        <input className="planning-title" aria-label="Note title" placeholder="Untitled note" value={active.title} maxLength={120} onChange={event => patch({title:event.target.value})}/>
        <AutoTextarea className="planning-body" aria-label="Note text" placeholder="Start writing…" value={active.body} onChange={event => patch({body:event.target.value})} spellCheck/>
      </div> : <div className="planning-folder-editor">
        {folder ? <><div className="eyebrow">FOLDER</div><label className="design-name">Folder name<input aria-label="Folder name" maxLength={120} value={folder.name} onChange={event => commit(value => ({ ...value, folders:value.folders.map(f => f.id === folder.id ? {...f,name:event.target.value} : f) }))}/></label><button className="design-remove" onClick={() => setDeleting({kind:'folder',id:folder.id})}>Delete folder</button></> : <h2>Scratch pad</h2>}
        <p className="design-empty-small">{data.notes.some(n => n.folderId === currentFolderId) ? 'Choose a note on the left, or start a new one.' : 'A blank page for your next idea.'}</p>
        <button className="design-button" onClick={addNote}>+ {folder ? `New note in ${folder.name || 'this folder'}` : 'New scratch'}</button>
      </div>}
    </section>
  </div>;
}
