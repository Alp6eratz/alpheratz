// Маршруты приложения собираются из плагинов; неизвестные адреса ведут на главную.
import { Routes } from '@angular/router';
import { collectPluginRoutes } from '@lingua/core/plugin-api';
import { APP_PLUGINS } from './plugins';

export const appRoutes: Routes = [
  ...collectPluginRoutes(APP_PLUGINS),
  { path: '**', redirectTo: '' },
];
