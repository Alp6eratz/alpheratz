// NgRx-фича «workspace»: раскладка интерфейса в стиле Obsidian.
import { createFeature, createReducer, on } from '@ngrx/store';
import { WorkspaceTab } from '@lingua/shared/models';
import { NotesActions } from '../notes/notes.actions';
import { WorkspaceActions } from './workspace.actions';

/** Состояние рабочей области. */
export interface WorkspaceState {
  /** Открытые вкладки. */
  tabs: WorkspaceTab[];
  /** Активная заметка или null (открыта другая страница). */
  activeNoteId: string | null;
  /** Открыта ли левая панель. */
  leftOpen: boolean;
  /** Открыта ли правая панель. */
  rightOpen: boolean;
  /** Активный вид левой панели. */
  leftView: string;
  /** Активный вид правой панели. */
  rightView: string;
  /** Текущий поисковый запрос. */
  searchQuery: string;
}

export const initialWorkspaceState: WorkspaceState = {
  tabs: [],
  activeNoteId: null,
  leftOpen: true,
  rightOpen: true,
  leftView: 'core:files',
  rightView: 'core:backlinks',
  searchQuery: '',
};

/** Удаляет вкладку и выбирает новую активную (соседнюю справа или слева). */
function removeTab(state: WorkspaceState, noteId: string): WorkspaceState {
  const index = state.tabs.findIndex((t) => t.noteId === noteId);
  if (index < 0) return state;
  const tabs = state.tabs.filter((t) => t.noteId !== noteId);
  const activeNoteId =
    state.activeNoteId === noteId
      ? (tabs[Math.min(index, tabs.length - 1)]?.noteId ?? null)
      : state.activeNoteId;
  return { ...state, tabs, activeNoteId };
}

export const workspaceFeature = createFeature({
  name: 'workspace',
  reducer: createReducer(
    initialWorkspaceState,
    on(WorkspaceActions.restored, (state, { state: restored }) => ({
      ...state,
      ...restored,
      activeNoteId: null,
    })),
    on(WorkspaceActions.openNote, (state, { noteId, mode }) => {
      const exists = state.tabs.find((t) => t.noteId === noteId);
      const tabs = exists
        ? state.tabs.map((t) => (t.noteId === noteId && mode ? { ...t, mode } : t))
        : [...state.tabs, { noteId, mode: mode ?? 'preview' }];
      return { ...state, tabs, activeNoteId: noteId };
    }),
    on(WorkspaceActions.leftNote, (state) => ({ ...state, activeNoteId: null })),
    on(WorkspaceActions.closeTab, (state, { noteId }) => removeTab(state, noteId)),
    on(NotesActions.noteDeleted, (state, { id }) => removeTab(state, id)),
    on(WorkspaceActions.closeOtherTabs, (state, { noteId }) => ({
      ...state,
      tabs: state.tabs.filter((t) => t.noteId === noteId),
      activeNoteId: noteId,
    })),
    on(WorkspaceActions.setMode, (state, { noteId, mode }) => ({
      ...state,
      tabs: state.tabs.map((t) => (t.noteId === noteId ? { ...t, mode } : t)),
    })),
    on(WorkspaceActions.toggleLeftPanel, (state) => ({ ...state, leftOpen: !state.leftOpen })),
    on(WorkspaceActions.toggleRightPanel, (state) => ({ ...state, rightOpen: !state.rightOpen })),
    on(WorkspaceActions.setLeftPanelOpen, (state, { open }) => ({ ...state, leftOpen: open })),
    on(WorkspaceActions.setRightPanelOpen, (state, { open }) => ({ ...state, rightOpen: open })),
    on(WorkspaceActions.setLeftView, (state, { view }) => ({
      ...state,
      leftView: view,
      leftOpen: true,
    })),
    on(WorkspaceActions.setRightView, (state, { view }) => ({
      ...state,
      rightView: view,
      rightOpen: true,
    })),
    on(WorkspaceActions.search, (state, { query }) => ({
      ...state,
      searchQuery: query,
      leftView: 'core:search',
      leftOpen: true,
    })),
    on(NotesActions.vaultImported, NotesActions.vaultReset, (state) => ({
      ...state,
      tabs: [],
      activeNoteId: null,
    })),
  ),
});

/** Активная вкладка. */
export const selectActiveTab = (state: { workspace: WorkspaceState }) =>
  state.workspace.tabs.find((t) => t.noteId === state.workspace.activeNoteId) ?? null;
