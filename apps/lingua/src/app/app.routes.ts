// Маршруты приложения: экраны входа/регистрации открыты гостям, все страницы плагинов
// доступны только после входа (authGuard). Неизвестные адреса ведут на главную.
import { Routes } from '@angular/router';
import { authGuard } from '@lingua/auth/data-access';
import { authRoutes } from '@lingua/auth/feature';
import { collectPluginRoutes } from '@lingua/core/plugin-api';
import { APP_PLUGINS } from './plugins';

export const appRoutes: Routes = [
  ...authRoutes,
  {
    path: '',
    canActivateChild: [authGuard],
    children: [...collectPluginRoutes(APP_PLUGINS), { path: '**', redirectTo: '' }],
  },
];
