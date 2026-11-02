// Фасад уроков: всё, что нужно экранам студента и администратора —
// списки уроков с учётом прав, прогресс, заметки, проверка, видеотека и статистика пользователей.
import { computed, inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { AuthFacade } from '@lingua/auth/data-access';
import { MediaStore } from '@lingua/core/data-access';
import {
  Lesson,
  LessonMaterial,
  LessonSubmission,
  SubmissionStatus,
  User,
  VideoItem,
} from '@lingua/shared/models';
import { createId } from '@lingua/shared/util';
import { computeLessonAccess } from './lesson-access';
import { LessonsActions } from './lessons.actions';
import { lessonsFeature } from './lessons.feature';

/** Статистика пользователя для панели администратора. */
export interface UserStats {
  user: User;
  /** Завершено уроков. */
  completed: number;
  /** Всего опубликованных уроков. */
  total: number;
  /** Процент прохождения. */
  percent: number;
  /** Последняя активность (ISO) или null. */
  lastActivity: string | null;
  /** Заметок на проверке. */
  pending: number;
  /** Заметок проверено. */
  reviewed: number;
  /** Активность: занимается (≤7 дней), не занимается, ещё не начинал. */
  activity: 'active' | 'idle' | 'new';
}

/** Новый материал без id (id выдаётся фасадом). */
export type NewMaterial = Omit<LessonMaterial, 'id'>;

/** Неделя в миллисекундах. */
const WEEK = 7 * 24 * 3600 * 1000;

@Injectable({ providedIn: 'root' })
export class LessonsFacade {
  private readonly store = inject(Store);
  private readonly auth = inject(AuthFacade);
  private readonly media = inject(MediaStore);

  readonly loaded = this.store.selectSignal(lessonsFeature.selectLoaded);
  readonly allLessons = this.store.selectSignal(lessonsFeature.selectSortedLessons);
  readonly progress = this.store.selectSignal(lessonsFeature.selectProgress);
  readonly submissions = this.store.selectSignal(lessonsFeature.selectSubmissions);
  readonly videos = this.store.selectSignal(lessonsFeature.selectVideos);
  readonly isAdmin = this.auth.isAdmin;
  readonly user = this.auth.user;

  /** Опубликованные уроки (то, что проходят студенты). */
  readonly publishedLessons = computed(() => this.allLessons().filter((l) => l.published));

  /** Уроки, видимые текущему пользователю: администратор видит и черновики. */
  readonly lessons = computed(() => (this.isAdmin() ? this.allLessons() : this.publishedLessons()));

  /** Прогресс текущего пользователя. */
  readonly myProgress = computed(() => this.progress().filter((p) => p.userId === this.user()?.id));

  /** Доступ к урокам: заблокирован / начат / завершён. */
  readonly access = computed(() =>
    computeLessonAccess(this.lessons(), this.myProgress(), this.isAdmin()),
  );

  /** Процент пройденного курса текущим пользователем. */
  readonly myPercent = computed(() => {
    const total = this.publishedLessons().length;
    const done = this.publishedLessons().filter((l) => this.access().get(l.id)?.completed).length;
    return total ? Math.round((done / total) * 100) : 0;
  });

  /** Заметки, ожидающие проверки. */
  readonly pendingReviews = computed(() =>
    this.submissions().filter((s) => s.status === 'submitted'),
  );

  /** Категории видеотеки. */
  readonly videoCategories = computed(() =>
    [
      ...new Set(
        this.videos()
          .map((v) => v.category)
          .filter(Boolean),
      ),
    ].sort(),
  );

  /** Статистика по всем студентам (для администратора). */
  readonly userStats = computed<UserStats[]>(() => {
    const total = this.publishedLessons().length;
    const published = new Set(this.publishedLessons().map((l) => l.id));
    const now = Date.now();
    return this.auth.users().map((user) => {
      const progress = this.progress().filter((p) => p.userId === user.id);
      const subs = this.submissions().filter((s) => s.userId === user.id);
      const completed = progress.filter((p) => p.completedAt && published.has(p.lessonId)).length;
      const dates = [
        ...progress.flatMap((p) => [p.startedAt, p.completedAt]),
        ...subs.map((s) => s.updatedAt),
      ].filter((d): d is string => !!d);
      const lastActivity = dates.sort().at(-1) ?? null;
      return {
        user,
        completed,
        total,
        percent: total ? Math.round((completed / total) * 100) : 0,
        lastActivity,
        pending: subs.filter((s) => s.status === 'submitted').length,
        reviewed: subs.filter((s) => s.status === 'reviewed').length,
        activity: !lastActivity
          ? 'new'
          : now - Date.parse(lastActivity) <= WEEK
            ? 'active'
            : 'idle',
      };
    });
  });

  // ---------- Чтение ----------

  /** Урок по id. */
  lesson(id: string): Lesson | null {
    return this.allLessons().find((l) => l.id === id) ?? null;
  }

  /** Заметка текущего пользователя к уроку. */
  mySubmission(lessonId: string): LessonSubmission | null {
    const userId = this.user()?.id;
    return this.submissions().find((s) => s.lessonId === lessonId && s.userId === userId) ?? null;
  }

  /** Следующий урок после указанного (в видимом списке). */
  nextLesson(id: string): Lesson | null {
    const list = this.lessons();
    const index = list.findIndex((l) => l.id === id);
    return index >= 0 ? (list[index + 1] ?? null) : null;
  }

  // ---------- Студент ----------

  /** Отмечает, что урок открыт. */
  startLesson(lessonId: string): void {
    const userId = this.user()?.id;
    if (userId)
      this.store.dispatch(
        LessonsActions.lessonStarted({ userId, lessonId, at: new Date().toISOString() }),
      );
  }

  /** Завершает урок. Возвращает текст ошибки, если завершить нельзя. */
  completeLesson(lessonId: string): string | null {
    const userId = this.user()?.id;
    const lesson = this.lesson(lessonId);
    if (!userId || !lesson) return 'Урок не найден';
    if (this.access().get(lessonId)?.locked) return 'Сначала пройдите предыдущие уроки';
    const note = this.mySubmission(lessonId);
    if (lesson.requireNote && (!note || note.status === 'draft')) {
      return 'Для завершения урока отправьте заметку на проверку преподавателю';
    }
    this.store.dispatch(
      LessonsActions.lessonCompleted({ userId, lessonId, at: new Date().toISOString() }),
    );
    return null;
  }

  /** Сохраняет черновик заметки студента к уроку. */
  saveNote(lessonId: string, content: string, submit = false): void {
    const userId = this.user()?.id;
    if (!userId) return;
    const existing = this.mySubmission(lessonId);
    const now = new Date().toISOString();
    const status: SubmissionStatus = submit ? 'submitted' : (existing?.status ?? 'draft');
    this.store.dispatch(
      LessonsActions.submissionSaved({
        submission: {
          id: existing?.id ?? createId(),
          lessonId,
          userId,
          content,
          status,
          teacherComment: existing?.teacherComment ?? '',
          reviewedBy: existing?.reviewedBy ?? null,
          reviewedAt: existing?.reviewedAt ?? null,
          submittedAt: submit ? now : (existing?.submittedAt ?? null),
          updatedAt: now,
        },
      }),
    );
  }

  // ---------- Администратор: уроки ----------

  /** Создаёт урок (черновик) и возвращает его. */
  createLesson(title: string, description = ''): Lesson {
    const now = new Date().toISOString();
    const lesson: Lesson = {
      id: createId(),
      title,
      description,
      order: this.allLessons().length + 1,
      published: false,
      requireNote: false,
      materials: [],
      createdAt: now,
      updatedAt: now,
    };
    this.store.dispatch(LessonsActions.lessonCreated({ lesson }));
    return lesson;
  }

  updateLesson(id: string, changes: Partial<Omit<Lesson, 'id' | 'materials'>>): void {
    this.store.dispatch(LessonsActions.lessonUpdated({ id, changes }));
  }

  /** Удаляет урок вместе с загруженными файлами его материалов. */
  deleteLesson(id: string): void {
    this.lesson(id)?.materials.forEach((m) => m.mediaId && this.media.remove(m.mediaId));
    this.store.dispatch(LessonsActions.lessonDeleted({ id }));
  }

  /** Сдвигает урок вверх/вниз в программе курса. */
  moveLesson(id: string, delta: number): void {
    const ids = this.allLessons().map((l) => l.id);
    const from = ids.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    this.store.dispatch(LessonsActions.lessonsReordered({ ids }));
  }

  /** Добавляет материал; если передан файл — сохраняет его в медиахранилище. */
  async addMaterial(lessonId: string, data: NewMaterial, file?: File | null): Promise<void> {
    const stored = file ? await this.media.save(file) : null;
    this.store.dispatch(
      LessonsActions.materialAdded({
        lessonId,
        material: { ...data, ...(stored ?? {}), id: createId() },
      }),
    );
  }

  /** Обновляет материал; новый файл заменяет старый. */
  async updateMaterial(
    lessonId: string,
    material: LessonMaterial,
    file?: File | null,
  ): Promise<void> {
    let next = material;
    if (file) {
      if (material.mediaId) await this.media.remove(material.mediaId);
      next = { ...material, ...(await this.media.save(file)), url: undefined };
    }
    this.store.dispatch(LessonsActions.materialUpdated({ lessonId, material: next }));
  }

  /** Удаляет материал и его файл. */
  removeMaterial(lessonId: string, material: LessonMaterial): void {
    if (material.mediaId) this.media.remove(material.mediaId);
    this.store.dispatch(LessonsActions.materialRemoved({ lessonId, materialId: material.id }));
  }

  moveMaterial(lessonId: string, materialId: string, delta: number): void {
    this.store.dispatch(LessonsActions.materialMoved({ lessonId, materialId, delta }));
  }

  // ---------- Администратор: проверка заметок ----------

  reviewSubmission(id: string, status: SubmissionStatus, comment: string): void {
    const reviewerId = this.user()?.id;
    if (!reviewerId) return;
    this.store.dispatch(
      LessonsActions.submissionReviewed({
        id,
        status,
        comment,
        reviewerId,
        at: new Date().toISOString(),
      }),
    );
  }

  // ---------- Видеотека ----------

  /** Добавляет видео (по ссылке или из файла). */
  async addVideo(
    data: Omit<VideoItem, 'id' | 'createdAt' | 'mediaId' | 'mimeType'>,
    file?: File | null,
  ): Promise<void> {
    const stored = file ? await this.media.save(file) : null;
    this.store.dispatch(
      LessonsActions.videoAdded({
        video: {
          ...data,
          id: createId(),
          createdAt: new Date().toISOString(),
          ...(stored ? { mediaId: stored.mediaId, mimeType: stored.mimeType, url: undefined } : {}),
        },
      }),
    );
  }

  updateVideo(id: string, changes: Partial<VideoItem>): void {
    this.store.dispatch(LessonsActions.videoUpdated({ id, changes }));
  }

  /** Удаляет видео и загруженный файл. */
  removeVideo(video: VideoItem): void {
    if (video.mediaId) this.media.remove(video.mediaId);
    this.store.dispatch(LessonsActions.videoRemoved({ id: video.id }));
  }
}
