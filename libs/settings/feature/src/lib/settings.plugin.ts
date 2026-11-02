// Системный плагин «Настройки»: страница параметров, управления плагинами и данными.
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { definePlugin } from '@lingua/core/plugin-api';

export const settingsPlugin = definePlugin({
  id: 'settings',
  name: 'Настройки',
  description: 'Тема, изучаемый язык, плагины, горячие клавиши, импорт и экспорт хранилища.',
  version: '1.0.0',
  icon: 'settings',
  core: true,
  routes: [
    {
      path: 'settings',
      title: 'Настройки · LinguaVault',
      loadComponent: () => import('./settings-page.component').then((m) => m.SettingsPageComponent),
    },
  ],
  ribbon: [
    {
      id: 'settings:ribbon',
      icon: 'settings',
      tooltip: 'Настройки',
      route: '/settings',
      bottom: true,
      order: 10,
    },
  ],
  commands: [
    {
      id: 'settings:open',
      name: 'Открыть настройки',
      icon: 'settings',
      hotkey: 'Mod+,',
      run: () => inject(Router).navigateByUrl('/settings'),
    },
  ],
});
