// Сессия повторения: показ карточки, переворот, оценка по SM-2, озвучивание, горячие клавиши.
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { SpeechService, VaultFacade } from '@lingua/core/data-access';
import { MarkdownService } from '@lingua/core/markdown';
import { Flashcard, ReviewGrade } from '@lingua/shared/models';
import { previewInterval } from '@lingua/shared/util';
import { FlashcardsService } from '../flashcards.service';

/** Кнопки оценки. */
const GRADES: { grade: ReviewGrade; label: string; key: string; cls: string }[] = [
  { grade: 'again', label: 'Снова', key: '1', cls: 'again' },
  { grade: 'hard', label: 'Трудно', key: '2', cls: 'hard' },
  { grade: 'good', label: 'Хорошо', key: '3', cls: 'good' },
  { grade: 'easy', label: 'Легко', key: '4', cls: 'easy' },
];

@Component({
  selector: 'lv-review',
  imports: [RouterLink, MatButtonModule, MatIconModule, MatProgressBarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKey($event)' },
  templateUrl: './review.component.html',
  styleUrl: './review.component.scss',
})
export class ReviewComponent {
  private readonly service = inject(FlashcardsService);
  private readonly speech = inject(SpeechService);
  private readonly markdown = inject(MarkdownService);
  readonly vault = inject(VaultFacade);

  /** Колода из query-параметра `?deck=`. */
  readonly deck = input<string>('all');
  /** Обратный режим `?reverse=1`: показываем перевод, вспоминаем слово. */
  readonly reverse = input<string | undefined>();

  readonly grades = GRADES;
  /** Очередь карточек занятия. */
  readonly queue = signal<Flashcard[]>([]);
  /** Количество карточек в начале занятия. */
  readonly initialSize = signal(0);
  /** Показан ли ответ. */
  readonly revealed = signal(false);
  /** Статистика занятия. */
  readonly answered = signal(0);
  readonly correct = signal(0);

  readonly isReverse = computed(() => !!this.reverse() && this.reverse() !== '0');
  readonly current = computed(() => this.queue()[0] ?? null);
  readonly done = computed(() => this.initialSize() > 0 && !this.current());
  readonly empty = computed(() => this.initialSize() === 0);
  readonly progress = computed(() => {
    const total = this.initialSize();
    return total ? Math.round(((total - this.queue().length) / total) * 100) : 0;
  });

  /** Вопрос и ответ с учётом режима, отрендеренные как Markdown. */
  readonly question = computed(() =>
    this.render(this.isReverse() ? this.current()?.back : this.current()?.front),
  );
  readonly answer = computed(() =>
    this.render(this.isReverse() ? this.current()?.front : this.current()?.back),
  );
  /** Подписи интервалов на кнопках. */
  readonly intervals = computed(() => {
    const card = this.current();
    if (!card) return {} as Record<ReviewGrade, string>;
    const p = this.service.progressOf(card);
    return Object.fromEntries(GRADES.map((g) => [g.grade, previewInterval(p, g.grade)])) as Record<
      ReviewGrade,
      string
    >;
  });
  /** Заметка-источник текущей карточки. */
  readonly sourceNote = computed(() => {
    const card = this.current();
    return card ? (this.vault.entities()[card.noteId] ?? null) : null;
  });

  constructor() {
    // Строим очередь при смене колоды (после загрузки хранилища).
    effect(() => {
      const deck = this.deck() || 'all';
      if (!this.vault.loaded()) return;
      untracked(() => {
        const queue = this.service.buildQueue(deck);
        this.queue.set(queue);
        this.initialSize.set(queue.length);
        this.revealed.set(false);
      });
    });
  }

  /** Показывает ответ. */
  reveal(): void {
    this.revealed.set(true);
    // В обратном режиме произносим слово, когда оно открывается.
    if (this.isReverse()) this.speakCurrent();
  }

  /** Произносит лицевую сторону (слово на изучаемом языке). */
  speakCurrent(): void {
    const card = this.current();
    if (card) this.speech.speak(card.front);
  }

  /** Оценивает ответ и переходит к следующей карточке. */
  rate(grade: ReviewGrade): void {
    const card = this.current();
    if (!card || !this.revealed()) return;
    const repeat = this.service.grade(card, grade);
    this.answered.update((n) => n + 1);
    if (grade !== 'again') this.correct.update((n) => n + 1);
    // «Снова» — карточка возвращается в конец очереди в этом же занятии.
    this.queue.update(([, ...rest]) => (repeat ? [...rest, card] : rest));
    this.revealed.set(false);
  }

  /** Горячие клавиши: пробел/Enter — показать, 1–4 — оценка, S — озвучить. */
  onKey(event: KeyboardEvent): void {
    if ((event.target as HTMLElement).closest('input, textarea') || !this.current()) return;
    if (!this.revealed() && (event.key === ' ' || event.key === 'Enter')) {
      event.preventDefault();
      this.reveal();
      return;
    }
    if (event.code === 'KeyS') {
      this.speakCurrent();
      return;
    }
    const grade = GRADES.find((g) => g.key === event.key);
    if (grade && this.revealed()) this.rate(grade.grade);
  }

  /** Рендер стороны карточки. */
  private render(text: string | undefined) {
    return this.markdown.renderInline(text ?? '');
  }
}
