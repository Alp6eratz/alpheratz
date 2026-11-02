// Правила доступа к урокам: студент не может открыть следующий урок, пока не завершит предыдущий.
import { Lesson, LessonProgress } from '@lingua/shared/models';

/** Состояние урока для конкретного пользователя. */
export interface LessonAccess {
  /** Урок заблокирован (не пройден предыдущий). */
  locked: boolean;
  /** Урок завершён. */
  completed: boolean;
  /** Урок начат. */
  started: boolean;
  /** Дата завершения. */
  completedAt: string | null;
}

/**
 * Вычисляет доступ к каждому уроку.
 * @param lessons уроки, отсортированные по порядку (для студента — только опубликованные)
 * @param progress прогресс текущего пользователя
 * @param isAdmin администратору доступны все уроки
 */
export function computeLessonAccess(
  lessons: Lesson[],
  progress: LessonProgress[],
  isAdmin: boolean,
): Map<string, LessonAccess> {
  const byLesson = new Map(progress.map((p) => [p.lessonId, p]));
  const result = new Map<string, LessonAccess>();
  let previousCompleted = true;
  for (const lesson of lessons) {
    const p = byLesson.get(lesson.id);
    const completed = !!p?.completedAt;
    result.set(lesson.id, {
      locked: !isAdmin && !previousCompleted,
      completed,
      started: !!p,
      completedAt: p?.completedAt ?? null,
    });
    previousCompleted = previousCompleted && completed;
  }
  return result;
}
