// Плагин «Администрирование»: база пользователей, их прогресс и проверка заметок к урокам.
// Кнопки и команды видны только администраторам, маршруты защищены adminGuard.
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { adminGuard } from '@lingua/auth/data-access';
import { definePlugin } from '@lingua/core/plugin-api';

export const adminPlugin = definePlugin({
  id: 'admin',
  name: 'Администрирование',
  description: 'Пользователи, прогресс студентов, проверка заметок к урокам.',
  version: '1.0.0',
  icon: 'admin_panel_settings',
  core: true,
  routes: [
    {
      path: 'admin',
      title: 'Администрирование · LinguaVault',
      canActivate: [adminGuard],
      loadComponent: () =>
        import('./dashboard/admin-dashboard.component').then((m) => m.AdminDashboardComponent),
    },
    {
      path: 'admin/users/:id',
      title: 'Пользователь · LinguaVault',
      canActivate: [adminGuard],
      loadComponent: () =>
        import('./user-detail/user-detail.component').then((m) => m.UserDetailComponent),
    },
  ],
  ribbon: [
    {
      id: 'admin:ribbon',
      icon: 'admin_panel_settings',
      tooltip: 'Администрирование',
      route: '/admin',
      order: 4,
      roles: ['admin'],
    },
  ],
  commands: [
    {
      id: 'admin:open',
      name: 'Администрирование: открыть панель',
      icon: 'admin_panel_settings',
      roles: ['admin'],
      run: () => inject(Router).navigateByUrl('/admin'),
    },
    {
      id: 'admin:reviews',
      name: 'Администрирование: проверить заметки студентов',
      icon: 'rate_review',
      roles: ['admin'],
      run: () => inject(Router).navigate(['/admin'], { queryParams: { tab: 'reviews' } }),
    },
  ],
});
