// Абстракция хранилища данных. Реализацию можно заменить (IndexedDB, сервер, файлы)
// через DI, не меняя остальной код приложения.
import { Injectable } from '@angular/core';

/** Контракт хранилища «ключ → JSON-значение». */
export abstract class VaultStorage {
  /** Читает значение по ключу или возвращает null. */
  abstract read<T>(key: string): T | null;
  /** Записывает значение по ключу. */
  abstract write<T>(key: string, value: T): void;
  /** Удаляет значение по ключу. */
  abstract remove(key: string): void;
}

/** Реализация по умолчанию на основе localStorage браузера. */
@Injectable()
export class LocalStorageVault extends VaultStorage {
  /** Префикс ключей, чтобы не конфликтовать с другими приложениями на том же домене. */
  private readonly prefix = 'lingua-vault:';

  read<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(this.prefix + key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      // Повреждённые данные или недоступный localStorage (приватный режим).
      return null;
    }
  }

  write<T>(key: string, value: T): void {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
    } catch (error) {
      console.warn('[LinguaVault] Не удалось сохранить данные', error);
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(this.prefix + key);
    } catch {
      /* игнорируем */
    }
  }
}

/** Ключи хранилища. */
export const STORAGE_KEYS = {
  notes: 'notes',
  folders: 'folders',
  workspace: 'workspace',
  settings: 'settings',
} as const;
