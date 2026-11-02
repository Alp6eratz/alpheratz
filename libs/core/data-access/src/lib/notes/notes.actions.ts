// NgRx-действия над заметками и папками хранилища.
import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Note } from '@lingua/shared/models';

export const NotesActions = createActionGroup({
  source: 'Notes',
  events: {
    /** Заметки загружены из хранилища (или созданы демо-данные). */
    'Vault Loaded': props<{ notes: Note[]; folders: string[] }>(),
    /** Создана новая заметка. `open` — сразу открыть во вкладке. */
    'Note Created': props<{ note: Note; open: boolean }>(),
    /** Изменён текст заметки. */
    'Content Changed': props<{ id: string; content: string; updatedAt: string }>(),
    /** Заметка переименована (ссылки в других заметках обновятся автоматически). */
    'Note Renamed': props<{ id: string; title: string; updatedAt: string }>(),
    /** Заметка перемещена в другую папку. */
    'Note Moved': props<{ id: string; folder: string }>(),
    /** Заметка удалена. */
    'Note Deleted': props<{ id: string }>(),
    /** Создана пустая папка. */
    'Folder Created': props<{ path: string }>(),
    /** Папка удалена вместе со всеми вложенными заметками. */
    'Folder Deleted': props<{ path: string }>(),
    /** Хранилище полностью заменено (импорт из файла). */
    'Vault Imported': props<{ notes: Note[]; folders: string[] }>(),
    /** Сброс к демонстрационным данным. */
    'Vault Reset': emptyProps(),
  },
});
