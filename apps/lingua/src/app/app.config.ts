// Конфигурация приложения: zoneless-режим, роутер, NgRx (store, effects, devtools),
// ядро данных, авторизация и плагины. Режим хранения данных (браузер или сервер)
// выбирается файлом config.json во время запуска.
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
import { HttpAuthBackend, provideAuth } from '@lingua/auth/data-access';
import {
  API_CONFIG,
  HttpMediaStore,
  HttpVaultStorage,
  MediaStore,
  provideCoreState,
  settingsFeature,
} from '@lingua/core/data-access';
import { appRoutes } from './app.routes';
import { APP_PLUGINS } from './plugins';

/** Настройки, прочитанные из config.json при запуске. */
export interface RuntimeConfig {
  /**
   * Адрес бэкенда. null или отсутствует — локальный режим (всё хранится в браузере);
   * пустая строка — бэкенд на том же адресе, что и сайт; иначе — полный адрес, например http://localhost:8000.
   */
  apiUrl?: string | null;
}

/** Провайдеры режима сервера: HTTP-реализации хранилища, авторизации и файлов. */
function serverProviders(url: string) {
  return {
    api: { provide: API_CONFIG, useValue: { url } },
    media: { provide: MediaStore, useClass: HttpMediaStore },
  };
}

/** Собирает конфигурацию приложения для выбранного режима. */
export function createAppConfig(runtime: RuntimeConfig): ApplicationConfig {
  const apiUrl = runtime.apiUrl ?? null;
  const server = apiUrl !== null ? serverProviders(apiUrl) : null;
  return {
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
      // Режим сервера: настройки API и загрузка файлов на бэкенд.
      ...(server ? [server.api, server.media] : []),
      // Ядро данных: заметки в браузере или на сервере.
      provideCoreState(server ? { storage: HttpVaultStorage } : {}),
      // Авторизация подключается после ядра: при восстановлении сессии она открывает хранилище пользователя.
      provideAuth(server ? { backend: HttpAuthBackend } : {}),
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
}
