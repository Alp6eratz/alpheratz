// Плагин «Видеотека»: отдельный раздел с видеоматериалами, которые добавляют администраторы.
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { definePlugin } from '@lingua/core/plugin-api';

export const videosPlugin = definePlugin({
  id: 'videos',
  name: 'Видеотека',
  description: 'Раздел с видеоматериалами: загрузка файлов или ссылки на YouTube/Vimeo.',
  version: '1.0.0',
  icon: 'video_library',
  routes: [
    {
      path: 'videos',
      title: 'Видеотека · LinguaVault',
      loadComponent: () =>
        import('./videos/videos-page.component').then((m) => m.VideosPageComponent),
    },
  ],
  ribbon: [
    {
      id: 'videos:ribbon',
      icon: 'video_library',
      tooltip: 'Видеотека',
      route: '/videos',
      order: 3,
    },
  ],
  commands: [
    {
      id: 'videos:open',
      name: 'Видеотека: открыть',
      icon: 'video_library',
      run: () => inject(Router).navigateByUrl('/videos'),
    },
  ],
});
