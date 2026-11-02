// Модели пользователей и ролей для регистрации, входа и разграничения доступа.

/** Роль пользователя: администратор (преподаватель) или обычный пользователь (студент). */
export type UserRole = 'admin' | 'student';

/** Публичные данные пользователя (без пароля) — то, что хранится в состоянии приложения. */
export interface User {
  /** Уникальный идентификатор. */
  id: string;
  /** Электронная почта — используется как логин. */
  email: string;
  /** Отображаемое имя. */
  name: string;
  /** Роль. */
  role: UserRole;
  /** Дата регистрации (ISO). */
  createdAt: string;
  /** Дата последнего входа (ISO) или null. */
  lastLoginAt: string | null;
}

/** Данные формы регистрации. */
export interface RegisterData {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  /** Код приглашения — обязателен для регистрации администратора. */
  inviteCode?: string;
}

/** Данные формы входа. */
export interface LoginData {
  email: string;
  password: string;
}

/** Названия ролей на русском. */
export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Администратор',
  student: 'Студент',
};
