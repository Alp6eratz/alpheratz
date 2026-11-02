// Контракты плагинов. Любая функция приложения (карточки, граф и т.д.) оформляется как плагин,
// который декларативно описывает свои маршруты, команды, кнопки, панели и расширения Markdown.
import { EnvironmentProviders, Provider, Type } from '@angular/core';
import { Routes } from '@angular/router';
import { MarkedExtension } from 'marked';

/** Команда, доступная из палитры команд (Ctrl+P) и по горячей клавише. */
export interface PluginCommand {
  /** Уникальный id в формате `плагин:команда`. */
  id: string;
  /** Название, отображаемое в палитре команд. */
  name: string;
  /** Иконка Material Symbols. */
  icon?: string;
  /** Роли, которым доступна команда (по умолчанию — всем вошедшим пользователям). */
  roles?: string[];
  /** Горячая клавиша, например `Mod+Shift+F` (Mod = Ctrl или ⌘). */
  hotkey?: string;
  /**
   * Действие команды. Выполняется внутри контекста внедрения зависимостей,
   * поэтому внутри можно вызывать `inject()`.
   */
  run: () => void;
}

/** Кнопка на ленте (ribbon) — вертикальной панели слева, как в Obsidian. */
export interface RibbonItem {
  /** Уникальный id кнопки. */
  id: string;
  /** Иконка Material Symbols. */
  icon: string;
  /** Подсказка при наведении. */
  tooltip: string;
  /** Маршрут, который откроется по нажатию… */
  route?: string;
  /** …или команда, которая будет выполнена. */
  commandId?: string;
  /** Порядок сортировки (меньше — выше). */
  order?: number;
  /** Разместить кнопку внизу ленты. */
  bottom?: boolean;
  /** Роли, которым видна кнопка (по умолчанию — всем). */
  roles?: string[];
}

/** Вид боковой панели (проводник, поиск, обратные ссылки…). */
export interface SidebarView {
  /** Уникальный id вида. */
  id: string;
  /** Заголовок. */
  title: string;
  /** Иконка Material Symbols. */
  icon: string;
  /** Сторона: левая или правая панель. */
  side: 'left' | 'right';
  /** Роли, которым виден вид (по умолчанию — всем). */
  roles?: string[];
  /** Standalone-компонент, отображаемый в панели. */
  component: Type<unknown>;
  /** Порядок сортировки. */
  order?: number;
}

/** Элемент строки состояния внизу окна. */
export interface StatusBarItem {
  /** Уникальный id. */
  id: string;
  /** Standalone-компонент элемента. */
  component: Type<unknown>;
  /** Порядок сортировки. */
  order?: number;
}

/** Описание плагина — главная точка расширения приложения. */
export interface LinguaPlugin {
  /** Уникальный идентификатор плагина. */
  id: string;
  /** Название для страницы настроек. */
  name: string;
  /** Краткое описание. */
  description: string;
  /** Версия плагина. */
  version: string;
  /** Иконка Material Symbols. */
  icon: string;
  /** Системный плагин нельзя отключить. */
  core?: boolean;
  /** Маршруты (лениво загружаемые страницы). Регистрируются при старте приложения. */
  routes?: Routes;
  /** Команды палитры. */
  commands?: PluginCommand[];
  /** Кнопки ленты. */
  ribbon?: RibbonItem[];
  /** Виды боковых панелей. */
  sidebarViews?: SidebarView[];
  /** Элементы строки состояния. */
  statusBar?: StatusBarItem[];
  /** Расширения синтаксиса Markdown (формат библиотеки marked). */
  markdownExtensions?: MarkedExtension[];
  /** Провайдеры плагина (например, `provideState` / `provideEffects` для NgRx). */
  providers?: (Provider | EnvironmentProviders)[];
}
