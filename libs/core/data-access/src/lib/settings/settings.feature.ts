// NgRx-фича «settings»: пользовательские настройки приложения.
import { createFeature, createReducer, on } from '@ngrx/store';
import { AppSettings, DEFAULT_SETTINGS } from '@lingua/shared/models';
import { NotesActions } from '../notes/notes.actions';
import { SettingsActions } from './settings.actions';

export const settingsFeature = createFeature({
  name: 'settings',
  reducer: createReducer<AppSettings>(
    DEFAULT_SETTINGS,
    // Настройки каждого пользователя восстанавливаются поверх значений по умолчанию.
    on(SettingsActions.restored, (_, { settings }) => ({ ...DEFAULT_SETTINGS, ...settings })),
    on(NotesActions.vaultClosed, () => DEFAULT_SETTINGS),
    on(SettingsActions.updated, (state, { changes }) => ({ ...state, ...changes })),
    on(SettingsActions.pluginToggled, (state, { pluginId, enabled }) => ({
      ...state,
      disabledPlugins: enabled
        ? state.disabledPlugins.filter((id) => id !== pluginId)
        : [...new Set([...state.disabledPlugins, pluginId])],
    })),
  ),
});
