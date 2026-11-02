// Конфигурация приложения: zoneless-режим, роутер, NgRx (store, effects, devtools),
// ядро данных и регистрация плагинов.
import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { provideRouter, withComponentInputBinding, withHashLocation } from '@angular/router';
import { provideStore, Store } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { DISABLED_PLUGINS, providePlugins } from '@lingua/core/plugin-api';
import { provideAuth } from '@lingua/auth/data-access';
import { provideCoreState, settingsFeature } from '@lingua/core/data-access';
import { appRoutes } from './app.routes';
import { APP_PLUGINS } from './plugins';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Angular 20: обнаружение изменений на сигналах без zone.js.
    provideZonelessChangeDetection(),
    // Hash-маршрутизация позволяет размещать приложение на любом статическом хостинге.
    provideRouter(appRoutes, withComponentInputBinding(), withHashLocation()),
    // Корневой store; состояния и эффекты ядра и плагинов добавляются ниже.
    provideStore(
      {},
      { runtimeChecks: { strictActionImmutability: true, strictStateImmutability: true } },
    ),
    provideCoreState(),
    // Авторизация подключается после ядра: при восстановлении сессии она открывает хранилище пользователя.
    provideAuth(),
    providePlugins(APP_PLUGINS),
    // Связываем список отключённых плагинов из NgRx с реестром плагинов.
    {
      provide: DISABLED_PLUGINS,
      useFactory: () => inject(Store).selectSignal(settingsFeature.selectDisabledPlugins),
    },
    // Иконки mat-icon берутся из шрифта Material Symbols Outlined.
    provideAppInitializer(() => {
      inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-outlined');
    }),
    provideStoreDevtools({ maxAge: 50, logOnly: !isDevMode(), connectInZone: false }),
  ],
};
