// Синхронизация уроков с бэкендом (режим сервера). Интерфейс работает оптимистично:
// действие сразу меняет состояние, а эффект отправляет его на сервер. Запросы выполняются
// строго по очереди (concatMap), чтобы, например, урок был создан раньше его материалов.
// При ошибке показываем сообщение и перезагружаем состояние с сервера.
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Action } from '@ngrx/store';
import { AuthActions } from '@lingua/auth/data-access';
import { ApiClient, API_CONFIG } from '@lingua/core/data-access';
import { Lesson, LessonProgress, LessonSubmission, VideoItem } from '@lingua/shared/models';
import { catchError, concatMap, EMPTY, filter, from, map, merge, of, switchMap, tap } from 'rxjs';
import { LessonsActions } from './lessons.actions';

/** Ответ GET /api/school/state. */
interface SchoolState {
  lessons: Lesson[];
  progress: LessonProgress[];
  submissions: LessonSubmission[];
  videos: VideoItem[];
}

/** Безопасное кодирование id в пути. */
const id = (value: string) => encodeURIComponent(value);

/** Текст ошибки. */
const message = (e: unknown) => (e instanceof Error ? e.message : 'Ошибка синхронизации');

/**
 * Загрузка курса с сервера: после входа, после восстановления сессии и по запросу.
 */
export const loadFromServer$ = createEffect(
  (actions$ = inject(Actions), api = inject(ApiClient), config = inject(API_CONFIG)) =>
    !config
      ? EMPTY
      : merge(
          actions$.pipe(
            ofType(AuthActions.sessionRestored, AuthActions.loginSuccess),
            filter(({ user }) => !!user),
          ),
          actions$.pipe(ofType(LessonsActions.reloadRequested)),
        ).pipe(
          // Новый запрос отменяет устаревший.
          switchMap(() =>
            from(api.get<SchoolState>('/api/school/state')).pipe(
              map((state) => LessonsActions.loaded(state)),
              catchError((e) =>
                of(LessonsActions.syncFailed({ error: message(e), reload: false })),
              ),
            ),
          ),
        ),
  { functional: true },
);

/** Отправка изменений на сервер. Каждое действие превращается в один запрос API. */
export const pushToServer$ = createEffect(
  (actions$ = inject(Actions), api = inject(ApiClient), config = inject(API_CONFIG)) => {
    if (!config) return EMPTY;

    /** Запрос API для действия (или null, если серверу ничего отправлять не нужно). */
    const request = (action: Action & Record<string, any>): Promise<unknown> | null => {
      switch (action.type) {
        // ----- Уроки -----
        case LessonsActions.lessonCreated.type: {
          const {
            id: lessonId,
            title,
            description,
            published,
            requireNote,
          } = action['lesson'] as Lesson;
          return api.post('/api/lessons', {
            id: lessonId,
            title,
            description,
            published,
            requireNote,
          });
        }
        case LessonsActions.lessonUpdated.type:
          return api.patch(`/api/lessons/${id(action['id'])}`, action['changes']);
        case LessonsActions.lessonDeleted.type:
          return api.delete(`/api/lessons/${id(action['id'])}`);
        case LessonsActions.lessonsReordered.type:
          return api.put('/api/lessons/order', { ids: action['ids'] });

        // ----- Материалы -----
        case LessonsActions.materialAdded.type:
          return api.post(`/api/lessons/${id(action['lessonId'])}/materials`, action['material']);
        case LessonsActions.materialUpdated.type:
          return api.put(
            `/api/lessons/${id(action['lessonId'])}/materials/${id(action['material'].id)}`,
            action['material'],
          );
        case LessonsActions.materialRemoved.type:
          return api.delete(
            `/api/lessons/${id(action['lessonId'])}/materials/${id(action['materialId'])}`,
          );
        case LessonsActions.materialMoved.type:
          return api.post(
            `/api/lessons/${id(action['lessonId'])}/materials/${id(action['materialId'])}/move`,
            { delta: action['delta'] },
          );

        // ----- Прогресс -----
        case LessonsActions.lessonStarted.type:
          return api.post(`/api/lessons/${id(action['lessonId'])}/start`);
        case LessonsActions.lessonCompleted.type:
          return api.post(`/api/lessons/${id(action['lessonId'])}/complete`);

        // ----- Заметки -----
        case LessonsActions.submissionSaved.type: {
          const s = action['submission'] as LessonSubmission;
          return api.put(`/api/lessons/${id(s.lessonId)}/submission`, {
            content: s.content,
            submit: s.status === 'submitted' && s.submittedAt === s.updatedAt,
          });
        }
        case LessonsActions.submissionReviewed.type:
          return api.post(`/api/submissions/${id(action['id'])}/review`, {
            status: action['status'],
            comment: action['comment'],
          });

        // ----- Видеотека -----
        case LessonsActions.videoAdded.type: {
          const v = action['video'] as VideoItem;
          return api.post('/api/videos', {
            id: v.id,
            title: v.title,
            description: v.description,
            category: v.category,
            url: v.url,
            mediaId: v.mediaId,
          });
        }
        case LessonsActions.videoUpdated.type:
          return api.patch(`/api/videos/${id(action['id'])}`, action['changes']);
        case LessonsActions.videoRemoved.type:
          return api.delete(`/api/videos/${id(action['id'])}`);
        default:
          return null;
      }
    };

    return actions$.pipe(
      ofType(
        LessonsActions.lessonCreated,
        LessonsActions.lessonUpdated,
        LessonsActions.lessonDeleted,
        LessonsActions.lessonsReordered,
        LessonsActions.materialAdded,
        LessonsActions.materialUpdated,
        LessonsActions.materialRemoved,
        LessonsActions.materialMoved,
        LessonsActions.lessonStarted,
        LessonsActions.lessonCompleted,
        LessonsActions.submissionSaved,
        LessonsActions.submissionReviewed,
        LessonsActions.videoAdded,
        LessonsActions.videoUpdated,
        LessonsActions.videoRemoved,
      ),
      concatMap((action) => {
        const promise = request(action);
        if (!promise) return EMPTY;
        return from(promise).pipe(
          concatMap((result) => {
            // Заметка: сохраняем серверный id и статус.
            if (action.type === LessonsActions.submissionSaved.type) {
              return of(
                LessonsActions.submissionSynced({ submission: result as LessonSubmission }),
              );
            }
            // Завершение урока открывает следующий — подгружаем его материалы.
            if (action.type === LessonsActions.lessonCompleted.type)
              return of(LessonsActions.reloadRequested());
            return EMPTY;
          }),
          catchError((e) => of(LessonsActions.syncFailed({ error: message(e), reload: true }))),
        );
      }),
    );
  },
  { functional: true },
);

/** Ошибка синхронизации: сообщение пользователю и перезагрузка актуального состояния с сервера. */
export const syncFailed$ = createEffect(
  (actions$ = inject(Actions), snackBar = inject(MatSnackBar)) =>
    actions$.pipe(
      ofType(LessonsActions.syncFailed),
      tap(({ error }) => snackBar.open(error, 'OK', { duration: 5000 })),
      // Ошибка самой загрузки не перезапускает загрузку — иначе получился бы бесконечный цикл.
      filter(({ reload }) => reload),
      map(() => LessonsActions.reloadRequested()),
    ),
  { functional: true },
);

export const lessonsSyncEffects = { loadFromServer$, pushToServer$, syncFailed$ };
