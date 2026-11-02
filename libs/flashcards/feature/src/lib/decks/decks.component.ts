// Страница колод: список колод по тегам со счётчиками и статистика за сегодня.
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { VaultFacade } from '@lingua/core/data-access';
import { Flashcard } from '@lingua/shared/models';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { DialogService } from '@lingua/shared/ui';
import { FlashcardsService } from '../flashcards.service';
import { AddCardData, AddCardDialog } from './add-card.dialog';

@Component({
  selector: 'lv-decks',
  imports: [
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
    MatSlideToggleModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './decks.component.html',
  styleUrl: './decks.component.scss',
})
export class DecksComponent {
  readonly service = inject(FlashcardsService);
  private readonly dialogs = inject(DialogService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  readonly vault = inject(VaultFacade);

  /** Поиск по списку карточек. */
  readonly cardQuery = signal('');
  /** Колода, выбранная для просмотра списка карточек. */
  readonly cardDeck = signal('all');

  /** Карточки выбранной колоды с учётом поиска. */
  readonly cardList = computed(() => {
    const q = this.cardQuery().trim().toLowerCase();
    const deck = this.cardDeck();
    return this.service
      .cards()
      .filter((c) => deck === 'all' || c.tags.includes(deck))
      .filter((c) => !q || `${c.front} ${c.back}`.toLowerCase().includes(q));
  });

  /** Открывает диалог добавления карточек. */
  addCard(): void {
    const decks = this.service
      .decks()
      .filter((d) => d.id !== 'all')
      .map((d) => d.id);
    const deck = this.cardDeck() !== 'all' ? this.cardDeck() : undefined;
    const ref = this.dialog.open<AddCardDialog, AddCardData, number>(AddCardDialog, {
      data: { decks, deck },
    });
    ref.componentInstance.onSave = ({ front, back, deck }) =>
      this.service.addCard(front, back, deck);
    ref.afterClosed().subscribe((count) => {
      if (count) this.snackBar.open(`Добавлено карточек: ${count}`, 'OK', { duration: 2500 });
    });
  }

  /** Удаляет карточку после подтверждения. */
  deleteCard(card: Flashcard): void {
    this.dialogs
      .confirm({
        title: 'Удалить карточку?',
        message: `«${card.front} — ${card.back}» будет удалена из заметки и колоды.`,
        confirmText: 'Удалить',
        danger: true,
      })
      .subscribe(() => this.service.deleteCard(card));
  }

  /** Доля изученных карточек (хотя бы раз повторённых). */
  readonly learnedPercent = computed(() => {
    const all = this.service.decks()[0];
    return all && all.total ? Math.round(((all.total - all.fresh) / all.total) * 100) : 0;
  });

  /** Последние 14 дней активности для мини-диаграммы. */
  readonly activity = computed(() => {
    const history = this.service.history();
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (13 - i));
      const key = d.toLocaleDateString('sv-SE');
      return {
        key,
        label: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
        count: history[key]?.reviewed ?? 0,
      };
    });
    const max = Math.max(1, ...days.map((d) => d.count));
    return days.map((d) => ({ ...d, height: Math.round((d.count / max) * 100) }));
  });

  /** Сбрасывает прогресс после подтверждения. */
  reset(): void {
    this.dialogs
      .confirm({
        title: 'Сбросить прогресс?',
        message: 'Вся история повторений будет удалена.',
        confirmText: 'Сбросить',
        danger: true,
      })
      .subscribe(() => this.service.reset());
  }
}
