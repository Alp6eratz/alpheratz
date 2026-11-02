// NgRx-действия рабочей области: вкладки, боковые панели, поиск.
import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { EditorMode } from '@lingua/shared/models';
import { WorkspaceState } from './workspace.feature';

export const WorkspaceActions = createActionGroup({
  source: 'Workspace',
  events: {
    /** Состояние восстановлено из хранилища. */
    Restored: props<{ state: Partial<WorkspaceState> }>(),
    /** Открыть заметку во вкладке (или активировать существующую). */
    'Open Note': props<{ noteId: string; mode?: EditorMode }>(),
    /** Пользователь ушёл на страницу, не являющуюся заметкой (граф, карточки…). */
    'Left Note': emptyProps(),
    /** Закрыть вкладку. */
    'Close Tab': props<{ noteId: string }>(),
    /** Закрыть все вкладки, кроме указанной. */
    'Close Other Tabs': props<{ noteId: string }>(),
    /** Сменить режим отображения вкладки. */
    'Set Mode': props<{ noteId: string; mode: EditorMode }>(),
    /** Переключить левую панель. */
    'Toggle Left Panel': emptyProps(),
    /** Переключить правую панель. */
    'Toggle Right Panel': emptyProps(),
    /** Явно открыть/закрыть левую панель. */
    'Set Left Panel Open': props<{ open: boolean }>(),
    /** Явно открыть/закрыть правую панель. */
    'Set Right Panel Open': props<{ open: boolean }>(),
    /** Выбрать вид левой панели. */
    'Set Left View': props<{ view: string }>(),
    /** Выбрать вид правой панели. */
    'Set Right View': props<{ view: string }>(),
    /** Изменить поисковый запрос (и открыть панель поиска). */
    Search: props<{ query: string }>(),
  },
});
