// Системный плагин «Заметки»: стартовая страница и страница заметки (лениво загружаемые).
import { definePlugin } from '@lingua/core/plugin-api';

export const notesPlugin = definePlugin({
  id: 'notes',
  name: 'Заметки',
  description: 'Редактор Markdown с вики-ссылками, тегами, callout-блоками и предпросмотром.',
  version: '1.0.0',
  icon: 'description',
  core: true,
  routes: [
    {
      path: '',
      pathMatch: 'full',
      title: 'LinguaVault',
      loadComponent: () => import('./home/home.component').then((m) => m.HomeComponent),
    },
    {
      path: 'note/:id',
      title: 'Заметка · LinguaVault',
      loadComponent: () =>
        import('./note-view/note-view.component').then((m) => m.NoteViewComponent),
    },
  ],
});
