// Применяет тему оформления (светлая/тёмная/системная) и размер шрифта к документу.
import { DOCUMENT, effect, inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { settingsFeature } from '../settings/settings.feature';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly store = inject(Store);
  private readonly theme = this.store.selectSignal(settingsFeature.selectTheme);
  private readonly fontSize = this.store.selectSignal(settingsFeature.selectEditorFontSize);

  /** Реактивно применяет тему при каждом изменении настроек. */
  private readonly apply = effect(() => {
    const root = this.document.documentElement;
    const theme = this.theme();
    // Angular Material 3 (mat.theme с theme-type: color-scheme) реагирует на CSS color-scheme.
    root.style.colorScheme = theme === 'system' ? 'light dark' : theme;
    root.dataset['theme'] = theme;
    root.style.setProperty('--lv-editor-font-size', `${this.fontSize()}px`);
  });

  /** Явная инициализация сервиса при старте приложения (создаёт экземпляр и эффект). */
  init(): void {
    /* Эффект создаётся в поле класса — здесь ничего делать не нужно. */
  }
}
