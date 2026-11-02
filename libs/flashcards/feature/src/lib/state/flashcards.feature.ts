// NgRx-фича «flashcards»: прогресс карточек по алгоритму SM-2 и история занятий по дням.
import { createFeature, createReducer, on } from '@ngrx/store';
import { CardProgress } from '@lingua/shared/models';
import { NotesActions } from '@lingua/core/data-access';
import { FlashcardsActions } from './flashcards.actions';

/** Статистика за день. */
export interface DayStats {
  /** Всего ответов. */
  reviewed: number;
  /** Новых карточек изучено. */
  learned: number;
}

/** Состояние плагина. */
export interface FlashcardsState {
  /** Прогресс по id карточки. */
  progress: Record<string, CardProgress>;
  /** История по датам `YYYY-MM-DD`. */
  history: Record<string, DayStats>;
}

const initialState: FlashcardsState = { progress: {}, history: {} };

export const flashcardsFeature = createFeature({
  name: 'flashcards',
  reducer: createReducer(
    initialState,
    // Прогресс нового пользователя полностью заменяет предыдущий.
    on(FlashcardsActions.restored, (_, { state: restored }) => ({ ...initialState, ...restored })),
    on(FlashcardsActions.cardReviewed, (state, { progress, isNew, date }) => {
      const day = state.history[date] ?? { reviewed: 0, learned: 0 };
      return {
        progress: { ...state.progress, [progress.cardId]: progress },
        history: {
          ...state.history,
          [date]: { reviewed: day.reviewed + 1, learned: day.learned + (isNew ? 1 : 0) },
        },
      };
    }),
    on(FlashcardsActions.cardForgotten, (state, { cardId }) => {
      const { [cardId]: _removed, ...progress } = state.progress;
      return { ...state, progress };
    }),
    on(FlashcardsActions.progressReset, NotesActions.vaultClosed, () => initialState),
  ),
});
