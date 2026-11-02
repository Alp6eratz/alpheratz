// Авторизация через бэкенд (FastAPI): регистрация и вход выдают JWT-токен,
// пользователь кэшируется в браузере, чтобы сессия восстанавливалась мгновенно при перезагрузке.
import { inject, Injectable } from '@angular/core';
import { ApiClient } from '@lingua/core/data-access';
import { LoginData, RegisterData, User, UserRole } from '@lingua/shared/models';
import { AuthBackend } from './auth-backend';

/** Ответ сервера на вход/регистрацию. */
interface AuthResponse {
  token: string;
  user: User;
}

/** Ключ кэша текущего пользователя. */
const USER_KEY = 'lingua-vault:api-user';

@Injectable()
export class HttpAuthBackend extends AuthBackend {
  private readonly api = inject(ApiClient);

  async register(data: RegisterData): Promise<User> {
    return this.saveSession(await this.api.post<AuthResponse>('/api/auth/register', data));
  }

  async login(data: LoginData): Promise<User> {
    return this.saveSession(await this.api.post<AuthResponse>('/api/auth/login', data));
  }

  logout(): void {
    this.api.setToken(null);
    try {
      localStorage.removeItem(USER_KEY);
    } catch {
      /* игнорируем */
    }
  }

  /**
   * Восстанавливает сессию из кэша синхронно (чтобы guards не ждали сеть),
   * а затем в фоне проверяет токен запросом /me — при 401 ApiClient инициирует выход.
   */
  restoreSession(): User | null {
    if (!this.api.token) return null;
    let user: User | null = null;
    try {
      user = JSON.parse(localStorage.getItem(USER_KEY) ?? 'null') as User | null;
    } catch {
      user = null;
    }
    if (user) {
      this.api
        .get<User>('/api/auth/me')
        .then((fresh) => localStorage.setItem(USER_KEY, JSON.stringify(fresh)))
        .catch(() => undefined);
    }
    return user;
  }

  listUsers(): Promise<User[]> {
    return this.api.get<User[]>('/api/users');
  }

  updateRole(userId: string, role: UserRole): Promise<User> {
    return this.api.patch<User>(`/api/users/${encodeURIComponent(userId)}/role`, { role });
  }

  deleteUser(userId: string): Promise<void> {
    return this.api.delete(`/api/users/${encodeURIComponent(userId)}`);
  }

  /** Сохраняет токен и пользователя после успешного входа. */
  private saveSession({ token, user }: AuthResponse): User {
    this.api.setToken(token);
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      /* игнорируем */
    }
    return user;
  }
}
