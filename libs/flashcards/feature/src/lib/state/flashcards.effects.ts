// Эффекты плагина карточек: загрузка и сохранение прогресса через общий VaultStorage.
import { inject } from '@angular/core';
import { createEffect } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { VaultStorage } from '@lingua/core/data-access';
import { debounceTime, defer, of, skip, tap } from 'rxjs';
import { FlashcardsActions } from './flashcards.actions';
import { flashcardsFeature, FlashcardsState } from './flashcards.feature';

/** Ключ хранилища плагина. */
const KEY = 'flashcards';

/**
 * Загрузка прогресса при регистрации эффекта.
 * Плагин подключается отдельным `provideEffects`, который уже не получает ROOT_EFFECTS_INIT,
 * поэтому читаем хранилище сразу при подписке (defer).
 */
export const restoreFlashcards$ = createEffect(
  (storage = inject(VaultStorage)) =>
    defer(() =>
      of(FlashcardsActions.restored({ state: storage.read<FlashcardsState>(KEY) ?? {} })),
    ),
  { functional: true },
);

/** Сохранение прогресса при каждом изменении. */
export const persistFlashcards$ = createEffect(
  (store = inject(Store), storage = inject(VaultStorage)) =>
    store.select(flashcardsFeature.selectFlashcardsState).pipe(
      skip(1),
      debounceTime(300),
      tap((state) => storage.write(KEY, state)),
    ),
  { functional: true, dispatch: false },
);

export const flashcardsEffects = { restoreFlashcards$, persistFlashcards$ };
