// Модели рабочей области: вкладки, панели, режимы — всё, что относится к раскладке UI.
import { EditorMode } from './settings.model';

/** Открытая вкладка (как вкладки в Obsidian). */
export interface WorkspaceTab {
  /** Идентификатор заметки во вкладке. */
  noteId: string;
  /** Режим отображения этой вкладки. */
  mode: EditorMode;
}

/** Идентификатор вида левой боковой панели. */
export type LeftPanelView = 'files' | 'search' | 'tags';

/** Идентификатор вида правой боковой панели. */
export type RightPanelView = 'backlinks' | 'outline' | 'tags';
