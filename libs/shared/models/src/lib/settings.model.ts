// Модель пользовательских настроек приложения.

/** Тема оформления. */
export type ThemeMode = 'light' | 'dark' | 'system';

/** Режим отображения заметки (как в Obsidian). */
export type EditorMode = 'edit' | 'preview' | 'split';

/** Изучаемый язык. */
export interface LanguageOption {
  /** BCP-47 код языка, например `en-US` (используется синтезом речи). */
  code: string;
  /** Название на русском. */
  label: string;
  /** Эмодзи-флаг. */
  flag: string;
}

/** Все настройки пользователя. */
export interface AppSettings {
  /** Тема оформления. */
  theme: ThemeMode;
  /** Режим редактора по умолчанию. */
  defaultEditorMode: EditorMode;
  /** Изучаемый язык (код BCP-47). */
  targetLanguage: string;
  /** Размер шрифта редактора в пикселях. */
  editorFontSize: number;
  /** Сколько новых карточек показывать в день. */
  newCardsPerDay: number;
  /** Идентификаторы отключённых плагинов. */
  disabledPlugins: string[];
}

/** Список поддерживаемых языков (легко расширяется). */
export const SUPPORTED_LANGUAGES: readonly LanguageOption[] = [
  { code: 'en-US', label: 'Английский', flag: '🇬🇧' },
  { code: 'de-DE', label: 'Немецкий', flag: '🇩🇪' },
  { code: 'es-ES', label: 'Испанский', flag: '🇪🇸' },
  { code: 'fr-FR', label: 'Французский', flag: '🇫🇷' },
  { code: 'it-IT', label: 'Итальянский', flag: '🇮🇹' },
  { code: 'ja-JP', label: 'Японский', flag: '🇯🇵' },
  { code: 'zh-CN', label: 'Китайский', flag: '🇨🇳' },
];

/** Настройки по умолчанию. */
export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  defaultEditorMode: 'preview',
  targetLanguage: 'en-US',
  editorFontSize: 16,
  newCardsPerDay: 20,
  disabledPlugins: [],
};
