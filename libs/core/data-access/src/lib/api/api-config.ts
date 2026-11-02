// Настройки подключения к бэкенду. Если токен API_CONFIG не задан, приложение работает
// полностью в браузере (локальный режим), иначе — через REST API бэкенда.
import { InjectionToken } from '@angular/core';

/** Параметры API. */
export interface ApiConfig {
  /** Базовый адрес бэкенда, например `http://localhost:8000`. Пустая строка — тот же адрес, что и сайт. */
  url: string;
}

/** Токен с настройками API (null — локальный режим без сервера). */
export const API_CONFIG = new InjectionToken<ApiConfig | null>('API_CONFIG', {
  providedIn: 'root',
  factory: () => null,
});
