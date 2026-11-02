// NgRx-действия уроков, материалов, прогресса студентов, заметок к урокам и видеотеки.
import { createActionGroup, emptyProps, props } from '@ngrx/store';
import {
  Lesson,
  LessonMaterial,
  LessonProgress,
  LessonSubmission,
  SubmissionStatus,
  VideoItem,
} from '@lingua/shared/models';

export const LessonsActions = createActionGroup({
  source: 'Lessons',
  events: {
    /** Данные загружены из хранилища. */
    Loaded: props<{
      lessons: Lesson[];
      progress: LessonProgress[];
      submissions: LessonSubmission[];
      videos: VideoItem[];
    }>(),

    // ----- Управление уроками (администратор) -----
    'Lesson Created': props<{ lesson: Lesson }>(),
    'Lesson Updated': props<{ id: string; changes: Partial<Omit<Lesson, 'id' | 'materials'>> }>(),
    'Lesson Deleted': props<{ id: string }>(),
    /** Новый порядок уроков (массив id). */
    'Lessons Reordered': props<{ ids: string[] }>(),

    // ----- Материалы урока (администратор) -----
    'Material Added': props<{ lessonId: string; material: LessonMaterial }>(),
    'Material Updated': props<{ lessonId: string; material: LessonMaterial }>(),
    'Material Removed': props<{ lessonId: string; materialId: string }>(),
    /** Сдвиг материала вверх (-1) или вниз (+1). */
    'Material Moved': props<{ lessonId: string; materialId: string; delta: number }>(),

    // ----- Прогресс студента -----
    'Lesson Started': props<{ userId: string; lessonId: string; at: string }>(),
    'Lesson Completed': props<{ userId: string; lessonId: string; at: string }>(),

    // ----- Заметки к урокам -----
    /** Создание или обновление заметки студента. */
    'Submission Saved': props<{ submission: LessonSubmission }>(),
    /** Проверка заметки преподавателем. */
    'Submission Reviewed': props<{
      id: string;
      status: SubmissionStatus;
      comment: string;
      reviewerId: string;
      at: string;
    }>(),

    /** Сервер подтвердил сохранение заметки (с серверным id). */
    'Submission Synced': props<{ submission: LessonSubmission }>(),

    // ----- Синхронизация с сервером -----
    /** Перезагрузить состояние с сервера (после ошибки или изменения доступа). */
    'Reload Requested': emptyProps(),
    /** Ошибка синхронизации с сервером. `reload` — перезагрузить состояние, чтобы отменить оптимистичное изменение. */
    'Sync Failed': props<{ error: string; reload: boolean }>(),

    // ----- Видеотека -----
    'Video Added': props<{ video: VideoItem }>(),
    'Video Updated': props<{ id: string; changes: Partial<VideoItem> }>(),
    'Video Removed': props<{ id: string }>(),
  },
});
