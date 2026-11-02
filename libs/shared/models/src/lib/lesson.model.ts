// Модели уроков, учебных материалов, прогресса студентов, заметок к урокам и видеотеки.

/** Тип учебного материала. */
export type MaterialType = 'text' | 'video' | 'audio' | 'image' | 'file' | 'link';

/** Учебный материал внутри урока. */
export interface LessonMaterial {
  /** Уникальный идентификатор. */
  id: string;
  /** Тип материала. */
  type: MaterialType;
  /** Заголовок материала. */
  title: string;
  /** Текст в Markdown (для типа `text`) или описание. */
  text?: string;
  /** Внешняя ссылка (YouTube, сайт, файл в облаке). */
  url?: string;
  /** Id загруженного файла в локальном медиахранилище (IndexedDB). */
  mediaId?: string;
  /** Имя исходного файла. */
  fileName?: string;
  /** MIME-тип файла. */
  mimeType?: string;
  /** Размер файла в байтах. */
  size?: number;
}

/** Урок. */
export interface Lesson {
  /** Уникальный идентификатор. */
  id: string;
  /** Название урока. */
  title: string;
  /** Краткое описание. */
  description: string;
  /** Порядковый номер — уроки проходятся строго по порядку. */
  order: number;
  /** Опубликован ли урок (черновики видят только администраторы). */
  published: boolean;
  /** Требовать отправку заметки на проверку перед завершением урока. */
  requireNote: boolean;
  /** Материалы урока. */
  materials: LessonMaterial[];
  /** Дата создания (ISO). */
  createdAt: string;
  /** Дата изменения (ISO). */
  updatedAt: string;
}

/** Прогресс пользователя по уроку. */
export interface LessonProgress {
  /** Пользователь. */
  userId: string;
  /** Урок. */
  lessonId: string;
  /** Когда урок впервые открыт (ISO). */
  startedAt: string;
  /** Когда урок завершён (ISO) или null. */
  completedAt: string | null;
}

/** Статус заметки студента к уроку. */
export type SubmissionStatus = 'draft' | 'submitted' | 'needs-work' | 'reviewed';

/** Заметка студента к уроку, которую проверяет преподаватель. */
export interface LessonSubmission {
  /** Уникальный идентификатор. */
  id: string;
  /** Урок. */
  lessonId: string;
  /** Автор-студент. */
  userId: string;
  /** Текст заметки в Markdown. */
  content: string;
  /** Статус проверки. */
  status: SubmissionStatus;
  /** Комментарий преподавателя. */
  teacherComment: string;
  /** Кто проверил (id администратора). */
  reviewedBy: string | null;
  /** Когда отправлено на проверку. */
  submittedAt: string | null;
  /** Когда проверено. */
  reviewedAt: string | null;
  /** Последнее изменение. */
  updatedAt: string;
}

/** Видео в видеотеке. */
export interface VideoItem {
  /** Уникальный идентификатор. */
  id: string;
  /** Название. */
  title: string;
  /** Описание. */
  description: string;
  /** Внешняя ссылка (YouTube / Vimeo / прямая ссылка на mp4). */
  url?: string;
  /** Загруженный файл в медиахранилище. */
  mediaId?: string;
  /** MIME-тип загруженного файла. */
  mimeType?: string;
  /** Категория (для фильтрации). */
  category: string;
  /** Дата добавления (ISO). */
  createdAt: string;
}

/** Подписи статусов заметок. */
export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  draft: 'Черновик',
  submitted: 'На проверке',
  'needs-work': 'Нужна доработка',
  reviewed: 'Проверено',
};

/** Подписи и иконки типов материалов. */
export const MATERIAL_TYPES: Record<MaterialType, { label: string; icon: string }> = {
  text: { label: 'Текст', icon: 'article' },
  video: { label: 'Видео', icon: 'smart_display' },
  audio: { label: 'Аудио', icon: 'headphones' },
  image: { label: 'Изображение', icon: 'image' },
  file: { label: 'Файл', icon: 'attach_file' },
  link: { label: 'Ссылка', icon: 'link' },
};
