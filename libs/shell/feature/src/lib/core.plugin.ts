// Системный плагин «Ядро»: базовые панели, команды и кнопки ленты.
// Оформлен тем же способом, что и сторонние плагины, — это демонстрирует единый механизм расширения.
import { inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { definePlugin } from '@lingua/core/plugin-api';
import {
  SettingsActions,
  settingsFeature,
  VaultFacade,
  WorkspaceActions,
} from '@lingua/core/data-access';
import { EditorMode } from '@lingua/shared/models';
import { CommandPaletteComponent } from './palette/command-palette.component';
import { BacklinksViewComponent } from './views/backlinks-view.component';
import { FileExplorerComponent } from './views/file-explorer.component';
import { OutlineViewComponent } from './views/outline-view.component';
import { SearchViewComponent } from './views/search-view.component';
import { TagsViewComponent } from './views/tags-view.component';

/** Циклическое переключение режимов отображения: просмотр → редактирование → раздельный. */
const NEXT_MODE: Record<EditorMode, EditorMode> = {
  preview: 'edit',
  edit: 'split',
  split: 'preview',
};

export const corePlugin = definePlugin({
  id: 'core',
  name: 'Ядро',
  description: 'Проводник, поиск, теги, ссылки, структура заметки и палитра команд.',
  version: '1.0.0',
  icon: 'deployed_code',
  core: true,

  sidebarViews: [
    {
      id: 'core:files',
      title: 'Файлы',
      icon: 'folder_open',
      side: 'left',
      component: FileExplorerComponent,
      order: 1,
    },
    {
      id: 'core:search',
      title: 'Поиск',
      icon: 'search',
      side: 'left',
      component: SearchViewComponent,
      order: 2,
    },
    {
      id: 'core:tags',
      title: 'Теги',
      icon: 'sell',
      side: 'left',
      component: TagsViewComponent,
      order: 3,
    },
    {
      id: 'core:backlinks',
      title: 'Ссылки',
      icon: 'link',
      side: 'right',
      component: BacklinksViewComponent,
      order: 1,
    },
    {
      id: 'core:outline',
      title: 'Структура',
      icon: 'toc',
      side: 'right',
      component: OutlineViewComponent,
      order: 2,
    },
  ],

  ribbon: [
    {
      id: 'core:ribbon-switcher',
      icon: 'manage_search',
      tooltip: 'Быстрый переход (Ctrl+O)',
      commandId: 'core:quick-switcher',
      order: 1,
    },
    {
      id: 'core:ribbon-daily',
      icon: 'calendar_today',
      tooltip: 'Заметка дня',
      commandId: 'core:daily-note',
      order: 5,
    },
    {
      id: 'core:ribbon-palette',
      icon: 'terminal',
      tooltip: 'Палитра команд (Ctrl+P)',
      commandId: 'core:command-palette',
      order: 90,
    },
    { id: 'core:ribbon-home', icon: 'home', tooltip: 'Главная', route: '/', order: 0 },
    {
      id: 'core:ribbon-theme',
      icon: 'contrast',
      tooltip: 'Сменить тему',
      commandId: 'core:toggle-theme',
      bottom: true,
      order: 1,
    },
  ],

  commands: [
    {
      id: 'core:command-palette',
      name: 'Открыть палитру команд',
      icon: 'terminal',
      hotkey: 'Mod+P',
      run: () => CommandPaletteComponent.open(inject(MatDialog), 'commands'),
    },
    {
      id: 'core:quick-switcher',
      name: 'Быстрый переход к заметке',
      icon: 'manage_search',
      hotkey: 'Mod+O',
      run: () => CommandPaletteComponent.open(inject(MatDialog), 'notes'),
    },
    {
      id: 'core:new-note',
      name: 'Создать новую заметку',
      icon: 'note_add',
      hotkey: 'Alt+N',
      run: () => {
        const vault = inject(VaultFacade);
        vault.createNote({ title: 'Без названия', folder: vault.activeNote()?.folder ?? '' });
      },
    },
    {
      id: 'core:daily-note',
      name: 'Открыть заметку дня (дневник)',
      icon: 'calendar_today',
      hotkey: 'Alt+D',
      run: () => inject(VaultFacade).openDailyNote(),
    },
    {
      id: 'core:search',
      name: 'Искать в хранилище',
      icon: 'search',
      hotkey: 'Mod+Shift+F',
      run: () => inject(Store).dispatch(WorkspaceActions.setLeftView({ view: 'core:search' })),
    },
    {
      id: 'core:toggle-mode',
      name: 'Переключить режим редактирования/просмотра',
      icon: 'edit',
      hotkey: 'Mod+E',
      run: () => {
        const vault = inject(VaultFacade);
        const note = vault.activeNote();
        if (note)
          inject(Store).dispatch(
            WorkspaceActions.setMode({ noteId: note.id, mode: NEXT_MODE[vault.activeMode()] }),
          );
      },
    },
    {
      id: 'core:toggle-left',
      name: 'Показать/скрыть левую панель',
      icon: 'left_panel_open',
      run: () => inject(Store).dispatch(WorkspaceActions.toggleLeftPanel()),
    },
    {
      id: 'core:toggle-right',
      name: 'Показать/скрыть правую панель',
      icon: 'right_panel_open',
      run: () => inject(Store).dispatch(WorkspaceActions.toggleRightPanel()),
    },
    {
      id: 'core:close-tab',
      name: 'Закрыть текущую вкладку',
      icon: 'close',
      hotkey: 'Alt+W',
      run: () => {
        const note = inject(VaultFacade).activeNote();
        if (note) inject(Store).dispatch(WorkspaceActions.closeTab({ noteId: note.id }));
      },
    },
    {
      id: 'core:toggle-theme',
      name: 'Переключить светлую/тёмную тему',
      icon: 'contrast',
      run: () => {
        const store = inject(Store);
        const theme = store.selectSignal(settingsFeature.selectTheme)();
        store.dispatch(
          SettingsActions.updated({ changes: { theme: theme === 'dark' ? 'light' : 'dark' } }),
        );
      },
    },
    {
      id: 'core:go-home',
      name: 'Перейти на главную',
      icon: 'home',
      run: () => inject(Router).navigateByUrl('/'),
    },
  ],
});
