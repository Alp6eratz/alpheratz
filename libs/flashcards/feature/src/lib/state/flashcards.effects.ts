// Эффекты плагина карточек: прогресс хранится в личном хранилище пользователя (VaultStorage),
// поэтому у каждого пользователя он свой и в режиме сервера синхронизируется между устройствами.
import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { NotesActions, scopedKey, VaultStorage } from '@lingua/core/data-access';
import { debounceTime, EMPTY, map, skip, switchMap, tap } from 'rxjs';
import { FlashcardsActions } from './flashcards.actions';
import { flashcardsFeature, FlashcardsState } from './flashcards.feature';

/** Ключ хранилища плагина. */
const KEY = 'flashcards';

/** После открытия хранилища пользователя загружаем его прогресс по карточкам. */
export const restoreFlashcards$ = createEffect(
  (actions$ = inject(Actions), storage = inject(VaultStorage)) =>
    actions$.pipe(
      ofType(NotesActions.vaultLoaded),
      map(({ scope }) =>
        FlashcardsActions.restored({
          state: storage.read<FlashcardsState>(scopedKey(scope, KEY)) ?? {},
        }),
      ),
    ),
  { functional: true },
);

/** Сохранение прогресса при изменениях; при смене пользователя поток переключается (switchMap). */
export const persistFlashcards$ = createEffect(
  (actions$ = inject(Actions), store = inject(Store), storage = inject(VaultStorage)) =>
    actions$.pipe(
      ofType(NotesActions.vaultLoaded, NotesActions.vaultClosed),
      switchMap((action) =>
        'scope' in action
          ? store.select(flashcardsFeature.selectFlashcardsState).pipe(
              // Пропускаем текущее значение (оно ещё от предыдущего пользователя).
              skip(1),
              debounceTime(300),
              tap((state) => storage.write(scopedKey(action.scope, KEY), state)),
            )
          : EMPTY,
      ),
    ),
  { functional: true, dispatch: false },
);

export const flashcardsEffects = { restoreFlashcards$, persistFlashcards$ };
