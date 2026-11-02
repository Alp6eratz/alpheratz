// Страница колод: список колод по тегам со счётчиками и статистика за сегодня.
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { DialogService } from '@lingua/shared/ui';
import { FlashcardsService } from '../flashcards.service';

@Component({
  selector: 'lv-decks',
  imports: [
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
