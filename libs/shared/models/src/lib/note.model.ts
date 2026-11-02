// Доменная модель заметки (аналог .md-файла в хранилище Obsidian).

/** Заметка в формате Markdown. */
export interface Note {
  /** Уникальный идентификатор заметки. */
  id: string;
  /** Заголовок заметки (используется в [[вики-ссылках]]). */
  title: string;
  /** Путь папки, например «Английский/Грамматика». Пустая строка — корень хранилища. */
  folder: string;
  /** Текст заметки в Markdown. */
  content: string;
  /** Время создания (ISO-строка). */
  createdAt: string;
  /** Время последнего изменения (ISO-строка). */
  updatedAt: string;
}

/** Ссылка между заметками, извлечённая из [[вики-ссылки]]. */
export interface NoteLink {
  /** Идентификатор заметки-источника. */
  sourceId: string;
  /** Заголовок, на который ссылаются (может не существовать — «неразрешённая» ссылка). */
  targetTitle: string;
  /** Идентификатор найденной заметки-цели или null. */
  targetId: string | null;
}

/** Заголовок внутри заметки — элемент панели «Структура». */
export interface NoteHeading {
  /** Уровень заголовка от 1 до 6. */
  level: number;
  /** Текст заголовка. */
  text: string;
  /** Якорь (slug) для прокрутки к заголовку. */
  slug: string;
}

/** Узел дерева файлового проводника: папка или заметка. */
export interface FileTreeNode {
  /** Тип узла. */
  kind: 'folder' | 'note';
  /** Отображаемое имя. */
  name: string;
  /** Полный путь (для папки) или id заметки. */
  key: string;
  /** Дочерние узлы (только у папок). */
  children: FileTreeNode[];
}

/** Данные для создания новой заметки. */
export type NewNote = Pick<Note, 'title' | 'folder'> & Partial<Pick<Note, 'content'>>;
