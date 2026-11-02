// Локальный «сервер» авторизации: пользователи хранятся в localStorage браузера,
// пароли — в виде хэша SHA-256 с солью. Подходит для демонстрации и обучения;
// для реального продукта авторизацию нужно перенести на сервер (см. AuthBackend).
import { inject, Injectable } from '@angular/core';
import { LoginData, RegisterData, User, UserRole } from '@lingua/shared/models';
import { createId, hashString } from '@lingua/shared/util';
import { ADMIN_INVITE_CODE, AuthBackend } from './auth-backend';

/** Запись пользователя вместе с хэшем пароля. */
interface StoredUser {
  user: User;
  salt: string;
  hash: string;
}

/** Ключи localStorage. */
const USERS_KEY = 'lingua-vault:auth:users';
const SESSION_KEY = 'lingua-vault:auth:session';

/** Учётная запись администратора, создаваемая при первом запуске. */
export const DEFAULT_ADMIN = {
  email: 'admin@lingua.local',
  password: 'admin12345',
  name: 'Администратор',
};

/** Вычисляет хэш пароля (SHA-256 через Web Crypto, с запасным вариантом). */
async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  if (globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Небезопасный контекст (http не на localhost) — используем простой хэш.
  return hashString(`${salt}:${password}`);
}

/** Нормализует email для сравнения. */
const normalize = (email: string) => email.trim().toLowerCase();

@Injectable()
export class LocalAuthBackend extends AuthBackend {
  private readonly inviteCode = inject(ADMIN_INVITE_CODE);
  /** Создание администратора по умолчанию выполняется один раз. */
  private readonly ready = this.ensureDefaultAdmin();

  async register(data: RegisterData): Promise<User> {
    await this.ready;
    const email = normalize(data.email);
    const users = this.readUsers();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Введите корректный email');
    if (data.password.length < 6) throw new Error('Пароль должен содержать не менее 6 символов');
    if (users.some((u) => u.user.email === email))
      throw new Error('Пользователь с таким email уже существует');
    if (data.role === 'admin' && data.inviteCode?.trim() !== this.inviteCode) {
      throw new Error('Неверный код приглашения администратора');
    }
    const salt = createId();
    const now = new Date().toISOString();
    const user: User = {
      id: createId(),
      email,
      name: data.name.trim() || email.split('@')[0],
      role: data.role,
      createdAt: now,
      lastLoginAt: now,
    };
    this.writeUsers([...users, { user, salt, hash: await hashPassword(data.password, salt) }]);
    this.setSession(user.id);
    return user;
  }

  async login(data: LoginData): Promise<User> {
    await this.ready;
    const users = this.readUsers();
    const record = users.find((u) => u.user.email === normalize(data.email));
    if (!record || record.hash !== (await hashPassword(data.password, record.salt))) {
      throw new Error('Неверный email или пароль');
    }
    record.user = { ...record.user, lastLoginAt: new Date().toISOString() };
    this.writeUsers(users);
    this.setSession(record.user.id);
    return record.user;
  }

  logout(): void {
    localStorage.removeItem(SESSION_KEY);
  }

  restoreSession(): User | null {
    try {
      const id = localStorage.getItem(SESSION_KEY);
      return id ? (this.readUsers().find((u) => u.user.id === id)?.user ?? null) : null;
    } catch {
      return null;
    }
  }

  listUsers(): User[] {
    return this.readUsers().map((u) => u.user);
  }

  updateRole(userId: string, role: UserRole): User {
    const users = this.readUsers();
    const record = users.find((u) => u.user.id === userId);
    if (!record) throw new Error('Пользователь не найден');
    if (
      role === 'student' &&
      record.user.role === 'admin' &&
      users.filter((u) => u.user.role === 'admin').length === 1
    ) {
      throw new Error('Нельзя снять роль с последнего администратора');
    }
    record.user = { ...record.user, role };
    this.writeUsers(users);
    return record.user;
  }

  deleteUser(userId: string): void {
    const users = this.readUsers();
    const target = users.find((u) => u.user.id === userId);
    if (
      target?.user.role === 'admin' &&
      users.filter((u) => u.user.role === 'admin').length === 1
    ) {
      throw new Error('Нельзя удалить последнего администратора');
    }
    this.writeUsers(users.filter((u) => u.user.id !== userId));
  }

  /** Создаёт администратора по умолчанию, если пользователей ещё нет. */
  private async ensureDefaultAdmin(): Promise<void> {
    if (this.readUsers().length) return;
    const salt = createId();
    const user: User = {
      id: createId(),
      email: DEFAULT_ADMIN.email,
      name: DEFAULT_ADMIN.name,
      role: 'admin',
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    };
    this.writeUsers([{ user, salt, hash: await hashPassword(DEFAULT_ADMIN.password, salt) }]);
  }

  private readUsers(): StoredUser[] {
    try {
      return JSON.parse(localStorage.getItem(USERS_KEY) ?? '[]') as StoredUser[];
    } catch {
      return [];
    }
  }

  private writeUsers(users: StoredUser[]): void {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  private setSession(userId: string): void {
    localStorage.setItem(SESSION_KEY, userId);
  }
}
