// Точка входа приложения: читает config.json (адрес бэкенда) и запускает корневой компонент.
import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { createAppConfig, RuntimeConfig } from './app/app.config';

/** Загружает настройки запуска; при ошибке — локальный режим без сервера. */
async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  try {
    const response = await fetch('config.json', { cache: 'no-store' });
    return response.ok ? ((await response.json()) as RuntimeConfig) : {};
  } catch {
    return {};
  }
}

loadRuntimeConfig()
  .then((runtime) => bootstrapApplication(App, createAppConfig(runtime)))
  .catch((err) => console.error(err));
