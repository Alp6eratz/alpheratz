// Подключение авторизации к приложению: бэкенд, NgRx-состояние, эффекты и роли для плагинов.
import { EnvironmentProviders, inject, makeEnvironmentProviders, Type } from '@angular/core';
import { provideEffects } from '@ngrx/effects';
import { provideState, Store } from '@ngrx/store';
import { CURRENT_ROLES } from '@lingua/core/plugin-api';
import { AuthBackend } from './auth-backend';
import { authEffects } from './auth.effects';
import { authFeature } from './auth.feature';
import { LocalAuthBackend } from './local-auth-backend';

/** Опции авторизации. */
export interface AuthOptions {
  /** Своя реализация сервера авторизации (по умолчанию — локальная). */
  backend?: Type<AuthBackend>;
}

export function provideAuth(options: AuthOptions = {}): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: AuthBackend, useClass: options.backend ?? LocalAuthBackend },
    provideState(authFeature),
    provideEffects(authEffects),
    // Роли текущего пользователя управляют видимостью кнопок и команд плагинов.
    {
      provide: CURRENT_ROLES,
      useFactory: () => inject(Store).selectSignal(authFeature.selectRoles),
    },
  ]);
}
