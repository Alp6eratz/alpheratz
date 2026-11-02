// NgRx-фича «notes»: состояние заметок на базе @ngrx/entity и редьюсер.
import { createEntityAdapter, EntityState } from '@ngrx/entity';
import { createFeature, createReducer, on } from '@ngrx/store';
import { Note } from '@lingua/shared/models';
import { NotesActions } from './notes.actions';

/** Состояние заметок: нормализованные сущности + список явно созданных папок. */
export interface NotesState extends EntityState<Note> {
  /** Загружено ли хранилище. */
  loaded: boolean;
  /** Пути папок (в том числе пустых). */
  folders: string[];
}

/** Адаптер сущностей: сортировка заметок по заголовку. */
export const notesAdapter = createEntityAdapter<Note>({
  sortComparer: (a, b) => a.title.localeCompare(b.title, 'ru'),
});

const initialState: NotesState = notesAdapter.getInitialState({ loaded: false, folders: [] });

/** Экранирует строку для использования в RegExp. */
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Заменяет [[Старое]] на [[Новое]] в тексте (сохраняя подписи и якоря). */
function replaceLinks(content: string, oldTitle: string, newTitle: string): string {
  const re = new RegExp(`\\[\\[${escapeRe(oldTitle)}(?=[\\]|#])`, 'gi');
  return content.replace(re, `[[${newTitle}`);
}

/** Проверяет, лежит ли папка/заметка внутри пути (включая сам путь). */
const isInside = (folder: string, path: string) => folder === path || folder.startsWith(path + '/');

export const notesFeature = createFeature({
  name: 'notes',
  reducer: createReducer(
    initialState,
    on(NotesActions.vaultLoaded, NotesActions.vaultImported, (state, { notes, folders }) =>
      notesAdapter.setAll(notes, { ...state, folders, loaded: true }),
    ),
    on(NotesActions.noteCreated, (state, { note }) => notesAdapter.addOne(note, state)),
    on(NotesActions.contentChanged, (state, { id, content, updatedAt }) =>
      notesAdapter.updateOne({ id, changes: { content, updatedAt } }, state),
    ),
    on(NotesActions.noteRenamed, (state, { id, title, updatedAt }) => {
      const oldTitle = state.entities[id]?.title;
      if (!oldTitle) return state;
      // Как в Obsidian: при переименовании обновляем все входящие ссылки.
      const updates = Object.values(state.entities)
        .filter(
          (n): n is Note =>
            !!n && n.id !== id && n.content.toLowerCase().includes(`[[${oldTitle.toLowerCase()}`),
        )
        .map((n) => ({ id: n.id, changes: { content: replaceLinks(n.content, oldTitle, title) } }));
      return notesAdapter.updateMany([{ id, changes: { title, updatedAt } }, ...updates], state);
    }),
    on(NotesActions.noteMoved, (state, { id, folder }) =>
      notesAdapter.updateOne({ id, changes: { folder } }, state),
    ),
    on(NotesActions.noteDeleted, (state, { id }) => notesAdapter.removeOne(id, state)),
    on(NotesActions.folderCreated, (state, { path }) =>
      state.folders.includes(path) ? state : { ...state, folders: [...state.folders, path].sort() },
    ),
    on(NotesActions.folderDeleted, (state, { path }) =>
      notesAdapter.removeMany((n) => isInside(n.folder, path), {
        ...state,
        folders: state.folders.filter((f) => !isInside(f, path)),
      }),
    ),
  ),
});

/** Базовые селекторы адаптера. */
const adapterSelectors = notesAdapter.getSelectors(notesFeature.selectNotesState);
export const selectAllNotes = adapterSelectors.selectAll;
export const selectNoteEntities = adapterSelectors.selectEntities;
export const selectNotesCount = adapterSelectors.selectTotal;
