// Фасад плагина карточек: колоды, очередь повторения, оценка ответов.
import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { settingsFeature, VaultFacade } from '@lingua/core/data-access';
import { Flashcard, ReviewGrade } from '@lingua/shared/models';
import { initialProgress, isDue, reviewCard } from '@lingua/shared/util';
import { map, timer } from 'rxjs';
import { FlashcardsActions } from './state/flashcards.actions';
import { flashcardsFeature } from './state/flashcards.feature';
import { selectAllCards } from './state/flashcards.selectors';

/** Колода: все карточки или карточки с определённым тегом. */
export interface Deck {
  /** `all` или имя тега. */
  id: string;
  title: string;
  total: number;
  due: number;
  fresh: number;
}

/** Сегодняшняя дата в формате YYYY-MM-DD (локальная). */
export const today = () => new Date().toLocaleDateString('sv-SE');

@Injectable({ providedIn: 'root' })
export class FlashcardsService {
  private readonly store = inject(Store);
  private readonly vault = inject(VaultFacade);

  readonly cards = this.store.selectSignal(selectAllCards);
  readonly progress = this.store.selectSignal(flashcardsFeature.selectProgress);
  readonly history = this.store.selectSignal(flashcardsFeature.selectHistory);
  private readonly newPerDay = this.store.selectSignal(settingsFeature.selectNewCardsPerDay);

  /** «Текущее время», обновляется раз в минуту — чтобы счётчики «к повторению» оживали сами. */
  readonly now = toSignal(timer(0, 60_000).pipe(map(() => Date.now())), {
    initialValue: Date.now(),
  });

  /** Сколько новых карточек ещё можно изучить сегодня. */
  readonly newLeftToday = computed(() =>
    Math.max(0, this.newPerDay() - (this.history()[today()]?.learned ?? 0)),
  );

  /** Статистика за сегодня. */
  readonly todayStats = computed(() => this.history()[today()] ?? { reviewed: 0, learned: 0 });

  /** Количество карточек к повторению сейчас (без учёта новых). */
  readonly dueCount = computed(() => this.stats(this.cards()).due);

  /** Колоды: «Все» + по тегам. */
  readonly decks = computed<Deck[]>(() => {
    const cards = this.cards();
    const tags = [...new Set(cards.flatMap((c) => c.tags))].sort((a, b) =>
      a.localeCompare(b, 'ru'),
    );
    return [
      { id: 'all', title: 'Все карточки', ...this.stats(cards) },
      ...tags.map((tag) => ({
        id: tag,
        title: `#${tag}`,
        ...this.stats(cards.filter((c) => c.tags.includes(tag))),
      })),
    ];
  });

  /** Количество карточек по видам: всего / к повторению / новых. */
  private stats(cards: Flashcard[]) {
    const progress = this.progress();
    const now = new Date(this.now());
    let due = 0;
    let fresh = 0;
    for (const c of cards) {
      const p = progress[c.id];
      if (!p) fresh++;
      else if (isDue(p, now)) due++;
    }
    return { total: cards.length, due, fresh };
  }

  /** Строит очередь занятия: сначала просроченные, затем новые (в пределах дневного лимита). */
  buildQueue(deckId: string): Flashcard[] {
    const progress = this.progress();
    const now = new Date();
    const cards =
      deckId === 'all' ? this.cards() : this.cards().filter((c) => c.tags.includes(deckId));
    const due = cards
      .filter((c) => progress[c.id] && isDue(progress[c.id], now))
      .sort((a, b) => progress[a.id].due.localeCompare(progress[b.id].due));
    const fresh = cards.filter((c) => !progress[c.id]).slice(0, this.newLeftToday());
    return [...due, ...fresh];
  }

  /** Применяет оценку к карточке. Возвращает true, если карточку нужно показать снова в этом занятии. */
  grade(card: Flashcard, grade: ReviewGrade): boolean {
    const current = this.progress()[card.id];
    const next = reviewCard(current ?? initialProgress(card.id), grade);
    this.store.dispatch(
      FlashcardsActions.cardReviewed({ progress: next, isNew: !current, date: today() }),
    );
    return next.interval === 0;
  }

  /** Прогресс карточки (или начальный). */
  progressOf(card: Flashcard) {
    return this.progress()[card.id] ?? initialProgress(card.id);
  }

  /**
   * Добавляет карточку. Карточки хранятся в заметках (как в Obsidian): новая строка
   * «лицевая :: оборотная» дописывается в заметку «Карточки — <колода>» в папке «Карточки».
   * Если такой заметки нет — она создаётся с тегом колоды.
   */
  addCard(front: string, back: string, deck: string): void {
    const clean = (v: string) => v.replace(/::/g, ':').replace(/\s+/g, ' ').trim();
    const f = clean(front);
    const b = clean(back);
    if (!f || !b) return;
    const tag = deck.trim().replace(/^#/, '').toLowerCase().replace(/\s+/g, '-') || 'мои-карточки';
    const title = `Карточки — ${tag}`;
    const line = `- ${f} :: ${b}`;
    const existingId = this.vault.titleIndex().get(title.toLowerCase());
    const note = existingId ? this.vault.entities()[existingId] : undefined;
    if (note) {
      this.vault.updateContent(note.id, `${note.content.replace(/\s*$/, '')}\n${line}\n`);
    } else {
      this.vault.createNote({ title, folder: 'Карточки', content: `#${tag}\n\n${line}\n` }, false);
    }
  }

  /** Удаляет карточку: убирает её строку из заметки-источника и забывает прогресс. */
  deleteCard(card: Flashcard): void {
    const note = this.vault.entities()[card.noteId];
    if (!note) return;
    const lines = note.content.split('\n');
    const index = lines.findIndex((l) => {
      const m = /^\s*(?:[-*]\s+)?(.+?)\s+::\s+(.+?)\s*$/.exec(l);
      return !!m && m[1].trim() === card.front;
    });
    if (index < 0) return;
    lines.splice(index, 1);
    this.vault.updateContent(note.id, lines.join('\n'));
    this.store.dispatch(FlashcardsActions.cardForgotten({ cardId: card.id }));
  }

  /** Сбрасывает весь прогресс. */
  reset(): void {
    this.store.dispatch(FlashcardsActions.progressReset());
  }
}
