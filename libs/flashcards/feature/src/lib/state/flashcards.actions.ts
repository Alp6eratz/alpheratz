// NgRx-действия плагина карточек.
import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { CardProgress } from '@lingua/shared/models';
import { FlashcardsState } from './flashcards.feature';

export const FlashcardsActions = createActionGroup({
  source: 'Flashcards',
  events: {
    /** Прогресс загружен из хранилища. */
    Restored: props<{ state: Partial<FlashcardsState> }>(),
    /** Карточка повторена: новый прогресс по SM-2. `isNew` — карточка показана впервые. */
    'Card Reviewed': props<{ progress: CardProgress; isNew: boolean; date: string }>(),
    /** Карточка удалена — забыть её прогресс. */
    'Card Forgotten': props<{ cardId: string }>(),
    /** Сбросить весь прогресс. */
    'Progress Reset': emptyProps(),
  },
});
