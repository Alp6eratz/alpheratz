// Абстракция сервера авторизации. Сейчас используется локальная реализация (LocalAuthBackend),
// но её можно заменить на настоящий REST/GraphQL API, не меняя остальной код приложения.
import { InjectionToken } from '@angular/core';
import { LoginData, RegisterData, User, UserRole } from '@lingua/shared/models';

export abstract class AuthBackend {
  /** Регистрирует пользователя и сразу выполняет вход. */
  abstract register(data: RegisterData): Promise<User>;
  /** Выполняет вход. Бросает ошибку с понятным сообщением при неверных данных. */
  abstract login(data: LoginData): Promise<User>;
  /** Завершает сессию. */
  abstract logout(): void;
  /** Восстанавливает сессию после перезагрузки страницы. */
  abstract restoreSession(): User | null;
  /** Список всех пользователей (для администраторов). Может выполняться асинхронно (сервер). */
  abstract listUsers(): User[] | Promise<User[]>;
  /** Меняет роль пользователя. */
  abstract updateRole(userId: string, role: UserRole): User | Promise<User>;
  /** Удаляет пользователя. */
  abstract deleteUser(userId: string): void | Promise<void>;
}

/** Код приглашения, который нужно ввести при регистрации администратора. */
export const ADMIN_INVITE_CODE = new InjectionToken<string>('ADMIN_INVITE_CODE', {
  providedIn: 'root',
  factory: () => 'LINGUA-ADMIN',
});
