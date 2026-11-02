// NgRx-фича «flashcards»: прогресс карточек по алгоритму SM-2 и история занятий по дням.
import { createFeature, createReducer, on } from '@ngrx/store';
import { CardProgress } from '@lingua/shared/models';
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
    on(FlashcardsActions.restored, (state, { state: restored }) => ({ ...state, ...restored })),
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
    on(FlashcardsActions.progressReset, () => initialState),
  ),
});
