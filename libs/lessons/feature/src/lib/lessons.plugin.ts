// Плагин «Уроки»: курс из последовательных уроков с материалами, заметками для проверки
// и редактором для администраторов. Регистрирует NgRx-состояние уроков.
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { adminGuard } from '@lingua/auth/data-access';
import { definePlugin } from '@lingua/core/plugin-api';
import { provideLessonsState } from '@lingua/lessons/data-access';

export const lessonsPlugin = definePlugin({
  id: 'lessons',
  name: 'Уроки',
  description:
    'Курс с последовательными уроками, учебными материалами и заметками на проверку преподавателю.',
  version: '1.0.0',
  icon: 'school',
  core: true,
  providers: [...provideLessonsState()],
  routes: [
    {
      path: 'lessons',
      title: 'Уроки · LinguaVault',
      loadComponent: () =>
        import('./list/lessons-list.component').then((m) => m.LessonsListComponent),
    },
    {
      path: 'lessons/:id',
      title: 'Урок · LinguaVault',
      loadComponent: () =>
        import('./view/lesson-view.component').then((m) => m.LessonViewComponent),
    },
    {
      path: 'lessons/:id/edit',
      title: 'Редактор урока · LinguaVault',
      canActivate: [adminGuard],
      loadComponent: () =>
        import('./editor/lesson-editor.component').then((m) => m.LessonEditorComponent),
    },
  ],
  ribbon: [{ id: 'lessons:ribbon', icon: 'school', tooltip: 'Уроки', route: '/lessons', order: 2 }],
  commands: [
    {
      id: 'lessons:open',
      name: 'Уроки: открыть курс',
      icon: 'school',
      hotkey: 'Alt+L',
      run: () => inject(Router).navigateByUrl('/lessons'),
    },
  ],
});
