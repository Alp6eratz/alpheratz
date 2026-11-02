// Реализация алгоритма интервального повторения SM-2 (как в Anki / плагине Spaced Repetition).
import { CardProgress, ReviewGrade } from '@lingua/shared/models';

/** Числовое качество ответа по шкале SM-2 (0–5) для каждой оценки. */
const GRADE_QUALITY: Record<ReviewGrade, number> = { again: 1, hard: 3, good: 4, easy: 5 };

/** Количество миллисекунд в сутках. */
const DAY_MS = 24 * 60 * 60 * 1000;

/** Создаёт начальный прогресс для новой карточки (доступна сразу). */
export function initialProgress(cardId: string, now = new Date()): CardProgress {
  return {
    cardId,
    ease: 2.5,
    interval: 0,
    repetitions: 0,
    due: now.toISOString(),
    lastReviewed: null,
  };
}

/** Вычисляет новый прогресс карточки после ответа пользователя. */
export function reviewCard(
  progress: CardProgress,
  grade: ReviewGrade,
  now = new Date(),
): CardProgress {
  const quality = GRADE_QUALITY[grade];
  let { ease, interval, repetitions } = progress;

  if (quality < 3) {
    // Ошибка: начинаем заново, карточка вернётся через 10 минут.
    repetitions = 0;
    interval = 0;
  } else {
    repetitions += 1;
    if (repetitions === 1) interval = 1;
    else if (repetitions === 2) interval = grade === 'easy' ? 4 : 3;
    else
      interval = Math.round(
        interval * ease * (grade === 'hard' ? 0.8 : grade === 'easy' ? 1.3 : 1),
      );
  }

  // Формула изменения коэффициента лёгкости из оригинального SM-2.
  ease = Math.max(1.3, ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

  const dueMs = interval === 0 ? now.getTime() + 10 * 60 * 1000 : now.getTime() + interval * DAY_MS;
  return {
    cardId: progress.cardId,
    ease: Number(ease.toFixed(2)),
    interval,
    repetitions,
    due: new Date(dueMs).toISOString(),
    lastReviewed: now.toISOString(),
  };
}

/** Проверяет, пора ли повторять карточку. */
export function isDue(progress: CardProgress | undefined, now = new Date()): boolean {
  return !progress || new Date(progress.due).getTime() <= now.getTime();
}

/** Человекочитаемый интервал до следующего показа для подписи кнопки. */
export function previewInterval(progress: CardProgress, grade: ReviewGrade): string {
  const next = reviewCard(progress, grade);
  return next.interval === 0 ? '10 мин' : `${next.interval} дн.`;
}
