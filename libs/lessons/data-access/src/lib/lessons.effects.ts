// Эффекты уроков: загрузка из хранилища при старте и сохранение при любых изменениях.
import { inject } from '@angular/core';
import { createEffect } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { API_CONFIG, VaultStorage } from '@lingua/core/data-access';
import { Lesson, LessonProgress, LessonSubmission, VideoItem } from '@lingua/shared/models';
import { debounceTime, defer, distinctUntilChanged, EMPTY, filter, of, tap } from 'rxjs';
import { LessonsActions } from './lessons.actions';
import { lessonsFeature } from './lessons.feature';
import { createSeedLessons } from './seed-lessons';
import { lessonsSyncEffects } from './lessons-sync.effects';

/** Ключи хранилища (данные курса общие для всех пользователей этой установки). */
const KEYS = {
  lessons: 'school:lessons',
  progress: 'school:progress',
  submissions: 'school:submissions',
  videos: 'school:videos',
} as const;

/**
 * Локальный режим: загрузка при регистрации эффекта; при первом запуске — демонстрационный курс.
 * В режиме сервера данные загружаются эффектами из lessons-sync.effects.ts.
 */
export const loadLessons$ = createEffect(
  (storage = inject(VaultStorage), api = inject(API_CONFIG)) =>
    api
      ? EMPTY
      : defer(() =>
          of(
            LessonsActions.loaded({
              lessons: storage.read<Lesson[]>(KEYS.lessons) ?? createSeedLessons(),
              progress: storage.read<LessonProgress[]>(KEYS.progress) ?? [],
              submissions: storage.read<LessonSubmission[]>(KEYS.submissions) ?? [],
              videos: storage.read<VideoItem[]>(KEYS.videos) ?? [],
            }),
          ),
        ),
  { functional: true },
);

/** Локальный режим: сохранение состояния в браузере при каждом изменении. */
export const persistLessons$ = createEffect(
  (store = inject(Store), storage = inject(VaultStorage), api = inject(API_CONFIG)) =>
    api
      ? EMPTY
      : store.select(lessonsFeature.selectLessonsState).pipe(
          filter((s) => s.loaded),
          debounceTime(300),
          distinctUntilChanged(),
          tap((s) => {
            storage.write(KEYS.lessons, s.lessons);
            storage.write(KEYS.progress, s.progress);
            storage.write(KEYS.submissions, s.submissions);
            storage.write(KEYS.videos, s.videos);
          }),
        ),
  { functional: true, dispatch: false },
);

export const lessonsEffects = { loadLessons$, persistLessons$, ...lessonsSyncEffects };
