// NgRx-фича «lessons»: уроки, прогресс, заметки студентов и видеотека (общие для всех пользователей).
import { createFeature, createReducer, createSelector, on } from '@ngrx/store';
import { Lesson, LessonProgress, LessonSubmission, VideoItem } from '@lingua/shared/models';
import { LessonsActions } from './lessons.actions';

export interface LessonsState {
  /** Загружены ли данные. */
  loaded: boolean;
  lessons: Lesson[];
  progress: LessonProgress[];
  submissions: LessonSubmission[];
  videos: VideoItem[];
}

const initialState: LessonsState = {
  loaded: false,
  lessons: [],
  progress: [],
  submissions: [],
  videos: [],
};

/** Обновляет урок по id. */
const patchLesson = (lessons: Lesson[], id: string, fn: (l: Lesson) => Lesson) =>
  lessons.map((l) => (l.id === id ? { ...fn(l), updatedAt: new Date().toISOString() } : l));

/** Пересчитывает поле order по порядку в массиве. */
const renumber = (lessons: Lesson[]) =>
  lessons.map((l, i) => (l.order === i + 1 ? l : { ...l, order: i + 1 }));

export const lessonsFeature = createFeature({
  name: 'lessons',
  reducer: createReducer(
    initialState,
    on(LessonsActions.loaded, (_, data) => ({ ...data, loaded: true })),

    on(LessonsActions.lessonCreated, (state, { lesson }) => ({
      ...state,
      lessons: renumber([...state.lessons, lesson]),
    })),
    on(LessonsActions.lessonUpdated, (state, { id, changes }) => ({
      ...state,
      lessons: patchLesson(state.lessons, id, (l) => ({ ...l, ...changes })),
    })),
    on(LessonsActions.lessonDeleted, (state, { id }) => ({
      ...state,
      lessons: renumber(state.lessons.filter((l) => l.id !== id)),
      progress: state.progress.filter((p) => p.lessonId !== id),
      submissions: state.submissions.filter((s) => s.lessonId !== id),
    })),
    on(LessonsActions.lessonsReordered, (state, { ids }) => ({
      ...state,
      lessons: renumber(
        ids.map((id) => state.lessons.find((l) => l.id === id)).filter((l): l is Lesson => !!l),
      ),
    })),

    on(LessonsActions.materialAdded, (state, { lessonId, material }) => ({
      ...state,
      lessons: patchLesson(state.lessons, lessonId, (l) => ({
        ...l,
        materials: [...l.materials, material],
      })),
    })),
    on(LessonsActions.materialUpdated, (state, { lessonId, material }) => ({
      ...state,
      lessons: patchLesson(state.lessons, lessonId, (l) => ({
        ...l,
        materials: l.materials.map((m) => (m.id === material.id ? material : m)),
      })),
    })),
    on(LessonsActions.materialRemoved, (state, { lessonId, materialId }) => ({
      ...state,
      lessons: patchLesson(state.lessons, lessonId, (l) => ({
        ...l,
        materials: l.materials.filter((m) => m.id !== materialId),
      })),
    })),
    on(LessonsActions.materialMoved, (state, { lessonId, materialId, delta }) => ({
      ...state,
      lessons: patchLesson(state.lessons, lessonId, (l) => {
        const materials = [...l.materials];
        const from = materials.findIndex((m) => m.id === materialId);
        const to = from + delta;
        if (from < 0 || to < 0 || to >= materials.length) return l;
        [materials[from], materials[to]] = [materials[to], materials[from]];
        return { ...l, materials };
      }),
    })),

    on(LessonsActions.lessonStarted, (state, { userId, lessonId, at }) =>
      state.progress.some((p) => p.userId === userId && p.lessonId === lessonId)
        ? state
        : {
            ...state,
            progress: [...state.progress, { userId, lessonId, startedAt: at, completedAt: null }],
          },
    ),
    on(LessonsActions.lessonCompleted, (state, { userId, lessonId, at }) => {
      const exists = state.progress.some((p) => p.userId === userId && p.lessonId === lessonId);
      return {
        ...state,
        progress: exists
          ? state.progress.map((p) =>
              p.userId === userId && p.lessonId === lessonId
                ? { ...p, completedAt: p.completedAt ?? at }
                : p,
            )
          : [...state.progress, { userId, lessonId, startedAt: at, completedAt: at }],
      };
    }),

    on(LessonsActions.submissionSaved, (state, { submission }) => ({
      ...state,
      submissions: state.submissions.some((s) => s.id === submission.id)
        ? state.submissions.map((s) => (s.id === submission.id ? submission : s))
        : [...state.submissions, submission],
    })),
    on(LessonsActions.submissionReviewed, (state, { id, status, comment, reviewerId, at }) => ({
      ...state,
      submissions: state.submissions.map((s) =>
        s.id === id
          ? {
              ...s,
              status,
              teacherComment: comment,
              reviewedBy: reviewerId,
              reviewedAt: at,
              updatedAt: at,
            }
          : s,
      ),
    })),

    on(LessonsActions.videoAdded, (state, { video }) => ({
      ...state,
      videos: [video, ...state.videos],
    })),
    on(LessonsActions.videoUpdated, (state, { id, changes }) => ({
      ...state,
      videos: state.videos.map((v) => (v.id === id ? { ...v, ...changes } : v)),
    })),
    on(LessonsActions.videoRemoved, (state, { id }) => ({
      ...state,
      videos: state.videos.filter((v) => v.id !== id),
    })),
  ),
  extraSelectors: ({ selectLessons }) => ({
    /** Уроки, отсортированные по порядку. */
    selectSortedLessons: createSelector(selectLessons, (lessons) =>
      [...lessons].sort((a, b) => a.order - b.order),
    ),
  }),
});
