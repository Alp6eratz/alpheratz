// Элемент строки состояния: количество карточек к повторению (клик — переход к колодам).
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FlashcardsService } from '../flashcards.service';

@Component({
  selector: 'lv-due-badge',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<a routerLink="/flashcards" class="badge" title="Карточки к повторению"
    >🃏 {{ service.dueCount() + service.newLeftToday() }} к изучению</a
  >`,
  styles: `
    .badge {
      color: inherit;
      text-decoration: none;
    }
    .badge:hover {
      color: var(--lv-text);
    }
  `,
})
export class DueBadgeComponent {
  readonly service = inject(FlashcardsService);
}
