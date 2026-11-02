// Страница настроек: внешний вид, обучение, плагины, горячие клавиши и данные.
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CommandService, formatHotkey, PluginRegistry } from '@lingua/core/plugin-api';
import { SettingsActions, VaultFacade } from '@lingua/core/data-access';
import { AppSettings, Note, SUPPORTED_LANGUAGES } from '@lingua/shared/models';
import { DialogService } from '@lingua/shared/ui';

/** Формат файла экспорта. */
interface VaultExport {
  app: 'lingua-vault';
  version: 1;
  notes: Note[];
  folders: string[];
}

@Component({
  selector: 'lv-settings-page',
  imports: [
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
    MatSliderModule,
    MatSlideToggleModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.scss',
})
export class SettingsPageComponent {
  private readonly store = inject(Store);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialogs = inject(DialogService);
  private readonly commands = inject(CommandService);
  readonly registry = inject(PluginRegistry);
  readonly vault = inject(VaultFacade);

  readonly languages = SUPPORTED_LANGUAGES;
  readonly settings = this.vault.settings;

  /** Команды с горячими клавишами для справочной таблицы. */
  readonly hotkeys = computed(() =>
    this.commands
      .commands()
      .filter((c) => c.hotkey)
      .map((c) => ({ name: c.name, hotkey: formatHotkey(c.hotkey!) })),
  );

  /** Обновляет настройку. */
  update<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.store.dispatch(SettingsActions.updated({ changes: { [key]: value } }));
  }

  /** Включает/выключает плагин. */
  togglePlugin(pluginId: string, enabled: boolean): void {
    this.store.dispatch(SettingsActions.pluginToggled({ pluginId, enabled }));
  }

  /** Включён ли плагин. */
  isEnabled(pluginId: string): boolean {
    return !this.settings().disabledPlugins.includes(pluginId);
  }

  /** Экспорт хранилища в JSON-файл. */
  exportVault(): void {
    const data: VaultExport = {
      app: 'lingua-vault',
      version: 1,
      notes: this.vault.notes(),
      folders: this.vault.folders(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lingua-vault-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Импорт хранилища из JSON или отдельных .md-файлов. */
  async importFiles(input: HTMLInputElement): Promise<void> {
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!files.length) return;
    try {
      if (files.length === 1 && files[0].name.endsWith('.json')) {
        const data = JSON.parse(await files[0].text()) as VaultExport;
        if (data.app !== 'lingua-vault' || !Array.isArray(data.notes))
          throw new Error('Неверный формат');
        this.vault.importVault(data.notes, data.folders ?? []);
        this.snackBar.open(`Импортировано заметок: ${data.notes.length}`, 'OK', { duration: 3000 });
        return;
      }
      // Markdown-файлы добавляются в папку «Импорт».
      for (const file of files.filter((f) => /\.(md|markdown|txt)$/i.test(f.name))) {
        this.vault.createNote(
          { title: file.name.replace(/\.\w+$/, ''), folder: 'Импорт', content: await file.text() },
          false,
        );
      }
      this.snackBar.open(`Добавлено файлов: ${files.length}`, 'OK', { duration: 3000 });
    } catch (error) {
      this.snackBar.open(`Ошибка импорта: ${(error as Error).message}`, 'OK', { duration: 4000 });
    }
  }

  /** Сброс к демонстрационным заметкам. */
  reset(): void {
    this.dialogs
      .confirm({
        title: 'Сбросить хранилище?',
        message:
          'Все заметки будут заменены демонстрационными. Сделайте экспорт, если нужно сохранить данные.',
        confirmText: 'Сбросить',
        danger: true,
      })
      .subscribe(() => this.vault.resetVault());
  }
}
