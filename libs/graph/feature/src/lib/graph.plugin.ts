// Плагин «Граф»: визуализация связей между заметками, как Graph View в Obsidian.
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { definePlugin } from '@lingua/core/plugin-api';

export const graphPlugin = definePlugin({
  id: 'graph',
  name: 'Граф связей',
  description: 'Интерактивный граф заметок и тегов с масштабированием и перетаскиванием узлов.',
  version: '1.0.0',
  icon: 'hub',
  routes: [
    {
      path: 'graph',
      title: 'Граф · LinguaVault',
      loadComponent: () => import('./graph-view.component').then((m) => m.GraphViewComponent),
    },
  ],
  ribbon: [{ id: 'graph:ribbon', icon: 'hub', tooltip: 'Граф связей', route: '/graph', order: 20 }],
  commands: [
    {
      id: 'graph:open',
      name: 'Граф: открыть граф связей',
      icon: 'hub',
      hotkey: 'Alt+G',
      run: () => inject(Router).navigateByUrl('/graph'),
    },
  ],
});
