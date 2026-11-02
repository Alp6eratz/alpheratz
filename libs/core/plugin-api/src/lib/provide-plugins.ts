// Функции подключения плагинов к приложению: провайдеры DI и сборка маршрутов.
import { EnvironmentProviders, inject, makeEnvironmentProviders, Provider } from '@angular/core';
import { Routes } from '@angular/router';
import { LinguaPlugin } from './plugin.model';
import { PluginRegistry } from './plugin-registry.service';
import { LINGUA_PLUGINS } from './plugin.tokens';

/** Регистрирует плагины и их собственные провайдеры (NgRx-состояния, сервисы и т.д.). */
export function providePlugins(plugins: LinguaPlugin[]): EnvironmentProviders {
  const providers: (Provider | EnvironmentProviders)[] = [];
  for (const plugin of plugins) {
    providers.push({ provide: LINGUA_PLUGINS, useValue: plugin, multi: true });
    providers.push(...(plugin.providers ?? []));
  }
  return makeEnvironmentProviders(providers);
}

/**
 * Собирает маршруты всех плагинов в один массив для `provideRouter`.
 * Каждый маршрут защищён `canMatch`: страницы отключённого плагина недоступны.
 */
export function collectPluginRoutes(plugins: LinguaPlugin[]): Routes {
  return plugins.flatMap((plugin) =>
    (plugin.routes ?? []).map((route) => ({
      ...route,
      canMatch: [...(route.canMatch ?? []), () => inject(PluginRegistry).isEnabled(plugin.id)],
    })),
  );
}

/** Вспомогательная функция для объявления плагина с проверкой типов. */
export function definePlugin(plugin: LinguaPlugin): LinguaPlugin {
  return plugin;
}
