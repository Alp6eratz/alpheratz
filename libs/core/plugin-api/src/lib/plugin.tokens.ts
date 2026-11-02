// Токены внедрения зависимостей плагинной системы.
import { InjectionToken, Signal, signal } from '@angular/core';
import { LinguaPlugin } from './plugin.model';

/** Multi-токен со всеми зарегистрированными плагинами. */
export const LINGUA_PLUGINS = new InjectionToken<LinguaPlugin[]>('LINGUA_PLUGINS');

/**
 * Сигнал со списком id отключённых плагинов.
 * Приложение связывает его с NgRx-настройками; по умолчанию все плагины включены.
 */
export const DISABLED_PLUGINS = new InjectionToken<Signal<string[]>>('DISABLED_PLUGINS', {
  providedIn: 'root',
  factory: () => signal<string[]>([]),
});
