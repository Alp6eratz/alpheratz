// NgRx-фича «settings»: пользовательские настройки приложения.
import { createFeature, createReducer, on } from '@ngrx/store';
import { AppSettings, DEFAULT_SETTINGS } from '@lingua/shared/models';
import { SettingsActions } from './settings.actions';

export const settingsFeature = createFeature({
  name: 'settings',
  reducer: createReducer<AppSettings>(
    DEFAULT_SETTINGS,
    on(SettingsActions.restored, (state, { settings }) => ({ ...state, ...settings })),
    on(SettingsActions.updated, (state, { changes }) => ({ ...state, ...changes })),
    on(SettingsActions.pluginToggled, (state, { pluginId, enabled }) => ({
      ...state,
      disabledPlugins: enabled
        ? state.disabledPlugins.filter((id) => id !== pluginId)
        : [...new Set([...state.disabledPlugins, pluginId])],
    })),
  ),
});
