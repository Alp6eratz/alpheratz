// Публичный API ядра данных: NgRx-состояния хранилища заметок, рабочей области, настроек и фасад.
export * from './lib/notes/notes.actions';
export * from './lib/notes/notes.feature';
export * from './lib/notes/notes.selectors';
export * from './lib/workspace/workspace.actions';
export * from './lib/workspace/workspace.feature';
export * from './lib/settings/settings.actions';
export * from './lib/settings/settings.feature';
export * from './lib/storage/vault-storage';
export * from './lib/storage/media-store';
export * from './lib/services/vault.facade';
export * from './lib/services/speech.service';
export * from './lib/services/theme.service';
export * from './lib/provide-core-state';
