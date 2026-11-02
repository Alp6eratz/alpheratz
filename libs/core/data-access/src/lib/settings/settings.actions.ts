// NgRx-действия настроек пользователя.
import { createActionGroup, props } from '@ngrx/store';
import { AppSettings } from '@lingua/shared/models';

export const SettingsActions = createActionGroup({
  source: 'Settings',
  events: {
    /** Настройки восстановлены из хранилища. */
    Restored: props<{ settings: Partial<AppSettings> }>(),
    /** Частичное обновление настроек. */
    Updated: props<{ changes: Partial<AppSettings> }>(),
    /** Включить/выключить плагин. */
    'Plugin Toggled': props<{ pluginId: string; enabled: boolean }>(),
  },
});
