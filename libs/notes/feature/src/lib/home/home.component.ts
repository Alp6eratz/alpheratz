// Стартовая страница: приветствие, статистика хранилища, быстрые действия и недавние заметки.
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { CommandService, PluginRegistry } from '@lingua/core/plugin-api';
import { VaultFacade } from '@lingua/core/data-access';
import { SUPPORTED_LANGUAGES } from '@lingua/shared/models';

@Component({
  selector: 'lv-home',
  imports: [DatePipe, MatButtonModule, MatCardModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  readonly vault = inject(VaultFacade);
  readonly commands = inject(CommandService);
  private readonly registry = inject(PluginRegistry);

  /** Изучаемый язык для приветствия. */
  readonly language = computed(
    () =>
      SUPPORTED_LANGUAGES.find((l) => l.code === this.vault.settings().targetLanguage) ??
      SUPPORTED_LANGUAGES[0],
  );

  /** Сводная статистика хранилища. */
  readonly stats = computed(() => {
    let words = 0;
    let cards = 0;
    this.vault.meta().forEach((m) => {
      words += m.words;
      cards += m.cards;
    });
    return [
      { icon: 'description', label: 'Заметок', value: this.vault.notes().length },
      { icon: 'style', label: 'Карточек', value: cards },
      { icon: 'sell', label: 'Тегов', value: this.vault.tags().length },
      { icon: 'notes', label: 'Слов', value: words },
    ];
  });

  /** Приветствие по времени суток. */
  readonly greeting = computed(() => {
    const h = new Date().getHours();
    return h < 6 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
  });

  /** Доступен ли плагин карточек (кнопка «Повторить» показывается только тогда). */
  readonly hasFlashcards = computed(() =>
    this.registry.enabled().some((p) => p.id === 'flashcards'),
  );

  /** Создаёт новую заметку. */
  newNote(): void {
    this.vault.createNote({ title: 'Без названия', folder: '' });
  }
}
