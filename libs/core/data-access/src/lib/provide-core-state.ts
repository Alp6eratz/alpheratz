// Подключение NgRx-состояния ядра к приложению одной функцией.
import { EnvironmentProviders, makeEnvironmentProviders, Type } from '@angular/core';
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';
import { notesFeature } from './notes/notes.feature';
import { coreEffects } from './persistence.effects';
import { settingsFeature } from './settings/settings.feature';
import { LocalStorageVault, VaultStorage } from './storage/vault-storage';
import { workspaceFeature } from './workspace/workspace.feature';

/** Опции подключения ядра. */
export interface CoreStateOptions {
  /** Своя реализация хранилища (по умолчанию localStorage). */
  storage?: Type<VaultStorage>;
}

/** Регистрирует фичи notes/workspace/settings, эффекты и хранилище. */
export function provideCoreState(options: CoreStateOptions = {}): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: VaultStorage, useClass: options.storage ?? LocalStorageVault },
    provideState(notesFeature),
    provideState(workspaceFeature),
    provideState(settingsFeature),
    provideEffects(coreEffects),
  ]);
}
