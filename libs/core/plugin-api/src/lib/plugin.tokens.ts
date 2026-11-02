// Токены внедрения зависимостей плагинной системы.
import { InjectionToken, Signal, signal } from '@angular/core';
import { LinguaPlugin } from './plugin.model';

/** Multi-токен со всеми зарегистрированными плагинами. */
export const LINGUA_PLUGINS = new InjectionToken<LinguaPlugin[]>('LINGUA_PLUGINS');

/**
 * Сигнал с ролями текущего пользователя. Приложение связывает его с NgRx-состоянием авторизации;
 * элементы плагинов с полем `roles` показываются только пользователям с подходящей ролью.
 */
export const CURRENT_ROLES = new InjectionToken<Signal<string[]>>('CURRENT_ROLES', {
  providedIn: 'root',
  factory: () => signal<string[]>([]),
});

/**
 * Сигнал со списком id отключённых плагинов.
 * Приложение связывает его с NgRx-настройками; по умолчанию все плагины включены.
 */
export const DISABLED_PLUGINS = new InjectionToken<Signal<string[]>>('DISABLED_PLUGINS', {
  providedIn: 'root',
  factory: () => signal<string[]>([]),
});
